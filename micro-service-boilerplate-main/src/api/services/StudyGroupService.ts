import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '../../lib/logger';

const log = new Logger(__filename);

type StudyGroupRow = {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  creator_id: string;
  max_members: number;
  settings: any;
  metadata: any;
  created_at: string;
  updated_at: string;
};

type MemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
};

type InviteRow = {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export class StudyGroupService {
  private readonly MAX_MEMBERS = 10;

  private async ensureFriends(userId: string, candidateIds: string[]): Promise<void> {
    if (!candidateIds.length) {
      return;
    }

    const { friendService } = await import('./FriendService');
    const checks = await Promise.all(candidateIds.map(id => friendService.areFriends(userId, id)));
    const notFriends = candidateIds.filter((_, idx) => !checks[idx]);
    if (notFriends.length) {
      throw new Error('You can only add friends to the study group');
    }
  }

  private enforceMaxMembers(value: number | null | undefined) {
    const max = typeof value === 'number' && value > 0 ? value : this.MAX_MEMBERS;
    return Math.min(max, this.MAX_MEMBERS);
  }

  private async buildGroupResponse(group: StudyGroupRow, userId: string) {
    const supabase = getSupabaseAdmin();
    const maxMembers = this.enforceMaxMembers(group.max_members);

    const { data: members } = await supabase
      .from('study_group_members')
      .select('id, group_id, user_id, role, created_at, updated_at')
      .eq('group_id', group.id);

    const memberRows = (members || []) as MemberRow[];
    const memberIds = memberRows.map(m => m.user_id);
    const adminIds = memberRows.filter(m => m.role === 'admin' || m.role === 'creator').map(m => m.user_id);

    const normalizedSettings = {
      isPrivate: Boolean(group.settings?.isPrivate ?? false),
      allowMemberInvites: Boolean(group.settings?.allowMemberInvites ?? false),
      requireApproval: Boolean(group.settings?.requireApproval ?? false)
    };

    return {
      _id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar || undefined,
      creatorId: group.creator_id,
      adminIds,
      memberIds,
      memberCount: memberIds.length,
      maxMembers,
      isCreator: group.creator_id === userId,
      isAdmin: adminIds.includes(userId),
      settings: normalizedSettings,
      metadata: group.metadata || {},
      createdAt: group.created_at,
      updatedAt: group.updated_at
    };
  }

  private async getGroupRow(groupId: string): Promise<StudyGroupRow> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('study_groups')
      .select('id, name, description, avatar, creator_id, max_members, settings, metadata, created_at, updated_at')
      .eq('id', groupId)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Group not found');
    }

    return data as StudyGroupRow;
  }

  private async requireAdmin(groupId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('study_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    const role = (data as any)?.role as string | undefined;
    if (role !== 'creator' && role !== 'admin') {
      throw new Error('Only admins can perform this action');
    }
  }

  /**
   * Create a new study group
   */
  async createGroup(
    creatorId: string,
    name: string,
    description?: string,
    metadata?: any,
    settings?: any,
    initialMemberIds: string[] = []
  ) {
    const supabase = getSupabaseAdmin();

    const sanitizedInitialMembers = Array.from(
      new Set((initialMemberIds || []).map(id => id && id.toString()).filter(Boolean).filter(id => id !== creatorId))
    );

    await this.ensureFriends(creatorId, sanitizedInitialMembers);

    if (sanitizedInitialMembers.length + 1 > this.MAX_MEMBERS) {
      throw new Error(`A study group can have at most ${this.MAX_MEMBERS} members`);
    }

    const groupSettings = {
      isPrivate: Boolean(settings?.isPrivate ?? false),
      allowMemberInvites: false,
      requireApproval: Boolean(settings?.requireApproval ?? false)
    };

    const { data: group, error } = await supabase
      .from('study_groups')
      .insert({
        name: name?.trim() || 'Study Group',
        description: description || '',
        creator_id: creatorId,
        max_members: this.MAX_MEMBERS,
        metadata: metadata || {},
        settings: groupSettings
      })
      .select('id, name, description, avatar, creator_id, max_members, settings, metadata, created_at, updated_at')
      .single();

    if (error || !group) {
      log.error('Failed to create group', { error: error?.message || error });
      throw new Error('Failed to create group');
    }

    const memberRows = [
      { group_id: (group as any).id, user_id: creatorId, role: 'creator' },
      ...sanitizedInitialMembers.map(id => ({ group_id: (group as any).id, user_id: id, role: 'member' }))
    ];

    const { error: membersError } = await supabase.from('study_group_members').insert(memberRows);
    if (membersError) {
      log.error('Failed to create group members', { error: membersError.message });
      throw new Error('Failed to create group members');
    }

    return this.buildGroupResponse(group as StudyGroupRow, creatorId);
  }

  /**
   * Get group details
   */
  async getGroup(groupId: string, userId: string) {
    const group = await this.getGroupRow(groupId);
    return this.buildGroupResponse(group, userId);
  }

  /**
   * Update group settings/details
   */
  async updateGroup(groupId: string, userId: string, updates: any) {
    const supabase = getSupabaseAdmin();
    await this.requireAdmin(groupId, userId);

    const group = await this.getGroupRow(groupId);
    const nextSettings = updates?.settings
      ? { ...(group.settings || {}), ...(updates.settings || {}), allowMemberInvites: false }
      : group.settings;

    const nextMetadata = updates?.metadata ? { ...(group.metadata || {}), ...(updates.metadata || {}) } : group.metadata;

    const payload: Record<string, any> = {
      name: updates?.name ? String(updates.name) : group.name,
      description: updates?.description !== undefined ? String(updates.description || '') : group.description,
      avatar: updates?.avatar !== undefined ? updates.avatar : group.avatar,
      settings: nextSettings,
      metadata: nextMetadata,
      max_members: this.MAX_MEMBERS
    };

    const { data, error } = await supabase
      .from('study_groups')
      .update(payload)
      .eq('id', groupId)
      .select('id, name, description, avatar, creator_id, max_members, settings, metadata, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new Error('Failed to update group');
    }

    return this.buildGroupResponse(data as StudyGroupRow, userId);
  }

  /**
   * Delete group
   */
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const group = await this.getGroupRow(groupId);
    if (group.creator_id !== userId) {
      throw new Error('Only group creator can delete the group');
    }

    await supabase.from('study_groups').delete().eq('id', groupId).throwOnError();
    log.info(`Study group deleted: ${groupId}`);
  }

  /**
   * Invite a member to group
   */
  async inviteMember(groupId: string, inviterId: string, inviteeId: string, message?: string): Promise<any> {
    const supabase = getSupabaseAdmin();
    await this.requireAdmin(groupId, inviterId);

    const group = await this.getGroupRow(groupId);
    const maxMembers = this.enforceMaxMembers(group.max_members);

    const { data: members } = await supabase.from('study_group_members').select('user_id').eq('group_id', groupId);
    const memberIds = (members || []).map((row: any) => row.user_id);

    if (memberIds.length >= maxMembers) {
      throw new Error('Group is full');
    }

    await this.ensureFriends(inviterId, [inviteeId]);

    if (memberIds.includes(inviteeId)) {
      throw new Error('User is already a member');
    }

    const { data: existing } = await supabase
      .from('study_group_invites')
      .select('id')
      .eq('group_id', groupId)
      .eq('invitee_id', inviteeId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) {
      throw new Error('Invitation already sent');
    }

    const { data: invite, error } = await supabase
      .from('study_group_invites')
      .insert({
        group_id: groupId,
        inviter_id: inviterId,
        invitee_id: inviteeId,
        status: 'pending',
        message: message || null
      })
      .select('id, group_id, inviter_id, invitee_id, status, message, created_at, updated_at')
      .single();

    if (error || !invite) {
      throw new Error('Failed to send invite');
    }

    // Enrich invite with group + inviter.
    const [{ data: inviterProfile }, { data: inviterSocial }] = await Promise.all([
      supabase.from('profiles').select('id, email').eq('id', inviterId).maybeSingle(),
      supabase.from('user_profiles').select('user_id, username').eq('user_id', inviterId).maybeSingle()
    ]);

    return {
      _id: (invite as any).id,
      groupId: { _id: group.id, name: group.name, description: group.description },
      inviterId: { _id: inviterId, email: (inviterProfile as any)?.email, username: (inviterSocial as any)?.username },
      inviteeId,
      status: (invite as any).status,
      message: (invite as any).message || undefined,
      createdAt: (invite as any).created_at
    };
  }

  async addMember(groupId: string, adminId: string, memberId: string) {
    const supabase = getSupabaseAdmin();
    await this.requireAdmin(groupId, adminId);

    const group = await this.getGroupRow(groupId);
    const maxMembers = this.enforceMaxMembers(group.max_members);

    const { data: members } = await supabase.from('study_group_members').select('user_id').eq('group_id', groupId);
    const memberIds = (members || []).map((row: any) => row.user_id);
    if (memberIds.length >= maxMembers) {
      throw new Error('Group is full');
    }
    if (memberIds.includes(memberId)) {
      throw new Error('User is already a member');
    }

    await this.ensureFriends(adminId, [memberId]);

    await supabase
      .from('study_group_members')
      .insert({ group_id: groupId, user_id: memberId, role: 'member' })
      .throwOnError();

    await supabase
      .from('study_group_invites')
      .delete()
      .eq('group_id', groupId)
      .eq('invitee_id', memberId)
      .eq('status', 'pending');

    log.info(`Member ${memberId} added to group ${groupId} by admin ${adminId}`);
    return this.buildGroupResponse(group, adminId);
  }

  /**
   * Accept invitation
   */
  async acceptInvite(inviteId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: invite, error } = await supabase
      .from('study_group_invites')
      .select('id, group_id, invitee_id, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (error || !invite) {
      throw new Error('Invitation not found');
    }

    const row = invite as any as InviteRow;
    if (row.invitee_id !== userId) {
      throw new Error('Unauthorized');
    }
    if (row.status !== 'pending') {
      throw new Error('Invitation is not pending');
    }

    const group = await this.getGroupRow(row.group_id);
    const maxMembers = this.enforceMaxMembers(group.max_members);
    const { data: members } = await supabase.from('study_group_members').select('user_id').eq('group_id', group.id);
    const memberIds = (members || []).map((m: any) => m.user_id);
    if (memberIds.length >= maxMembers) {
      throw new Error('Group is full');
    }

    await supabase.from('study_group_members').insert({ group_id: group.id, user_id: userId, role: 'member' });
    await supabase.from('study_group_invites').update({ status: 'accepted' }).eq('id', inviteId);
  }

  async declineInvite(inviteId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: invite } = await supabase
      .from('study_group_invites')
      .select('id, invitee_id')
      .eq('id', inviteId)
      .maybeSingle();

    if (!invite) {
      throw new Error('Invitation not found');
    }
    if ((invite as any).invitee_id !== userId) {
      throw new Error('Unauthorized');
    }
    await supabase.from('study_group_invites').update({ status: 'declined' }).eq('id', inviteId);
  }

  async joinGroup(groupId: string, userId: string) {
    const supabase = getSupabaseAdmin();
    const group = await this.getGroupRow(groupId);

    if (group.settings?.isPrivate) {
      throw new Error('This group is private. Ask an admin to add you.');
    }

    const { data: members } = await supabase.from('study_group_members').select('user_id').eq('group_id', groupId);
    const memberIds = (members || []).map((m: any) => m.user_id);
    if (memberIds.includes(userId)) {
      throw new Error('You are already a member of this group');
    }
    if (memberIds.length >= this.enforceMaxMembers(group.max_members)) {
      throw new Error('Group is full');
    }

    await supabase.from('study_group_members').insert({ group_id: groupId, user_id: userId, role: 'member' });
    return this.buildGroupResponse(group, userId);
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const group = await this.getGroupRow(groupId);
    if (group.creator_id === userId) {
      throw new Error('Creator cannot leave group. Delete the group instead.');
    }

    await supabase.from('study_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  }

  async getUserGroups(userId: string) {
    const supabase = getSupabaseAdmin();
    const { data: memberships } = await supabase
      .from('study_group_members')
      .select('group_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const groupIds = Array.from(new Set((memberships || []).map((m: any) => m.group_id))).filter(Boolean);
    if (!groupIds.length) {
      return [];
    }

    const { data: groups } = await supabase
      .from('study_groups')
      .select('id, name, description, avatar, creator_id, max_members, settings, metadata, created_at, updated_at')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    const rows = (groups || []) as StudyGroupRow[];
    const result = [];
    for (const row of rows) {
      result.push(await this.buildGroupResponse(row, userId));
    }
    return result;
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const group = await this.getGroupRow(groupId);

    const { data: members } = await supabase
      .from('study_group_members')
      .select('id, group_id, user_id, role, created_at, updated_at')
      .eq('group_id', groupId);

    const memberRows = (members || []) as MemberRow[];
    const userIds = memberRows.map(m => m.user_id);

    const [{ data: profiles }, { data: social }] = await Promise.all([
      supabase.from('profiles').select('id, email, first_name, last_name').in('id', userIds),
      supabase.from('user_profiles').select('user_id, username, avatar, bio, last_active').in('user_id', userIds)
    ]);

    const profileById = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
    const socialById = new Map<string, any>((social || []).map((p: any) => [p.user_id, p]));

    return memberRows.map(m => {
      const p = profileById.get(m.user_id);
      const s = socialById.get(m.user_id);
      const displayName = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
      const isCreator = group.creator_id === m.user_id;
      const isAdmin = m.role === 'admin' || m.role === 'creator' || isCreator;

      return {
        id: m.id,
        userId: m.user_id,
        displayName: displayName || s?.username || p?.email,
        email: p?.email,
        username: s?.username,
        avatar: s?.avatar,
        bio: s?.bio,
        lastActive: s?.last_active,
        isAdmin,
        isCreator
      };
    });
  }

  async getUserInvites(userId: string): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const { data: invites } = await supabase
      .from('study_group_invites')
      .select('id, group_id, inviter_id, invitee_id, status, message, created_at, updated_at')
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const rows = (invites || []) as InviteRow[];
    if (!rows.length) return [];

    const groupIds = rows.map(r => r.group_id);
    const inviterIds = rows.map(r => r.inviter_id);

    const [{ data: groups }, { data: inviterProfiles }, { data: inviterSocial }] = await Promise.all([
      supabase.from('study_groups').select('id, name, description').in('id', groupIds),
      supabase.from('profiles').select('id, email').in('id', inviterIds),
      supabase.from('user_profiles').select('user_id, username').in('user_id', inviterIds)
    ]);

    const groupById = new Map<string, any>((groups || []).map((g: any) => [g.id, g]));
    const inviterById = new Map<string, any>((inviterProfiles || []).map((p: any) => [p.id, p]));
    const inviterSocialById = new Map<string, any>((inviterSocial || []).map((p: any) => [p.user_id, p]));

    return rows.map(r => {
      const g = groupById.get(r.group_id);
      const p = inviterById.get(r.inviter_id);
      const s = inviterSocialById.get(r.inviter_id);
      return {
        _id: r.id,
        groupId: {
          _id: r.group_id,
          name: g?.name,
          description: g?.description
        },
        inviterId: {
          _id: r.inviter_id,
          email: p?.email,
          username: s?.username
        },
        inviteeId: r.invitee_id,
        status: r.status,
        message: r.message || undefined,
        createdAt: r.created_at
      };
    });
  }

  async removeMember(groupId: string, adminId: string, memberId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await this.requireAdmin(groupId, adminId);
    const group = await this.getGroupRow(groupId);

    if (group.creator_id === memberId) {
      throw new Error('Cannot remove group creator');
    }

    await supabase.from('study_group_members').delete().eq('group_id', groupId).eq('user_id', memberId);
  }

  async promoteToAdmin(groupId: string, promoterId: string, memberId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await this.requireAdmin(groupId, promoterId);

    const { data: membership } = await supabase
      .from('study_group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .maybeSingle();

    if (!membership) {
      throw new Error('User is not a member of this group');
    }

    const role = (membership as any).role;
    if (role === 'admin' || role === 'creator') {
      throw new Error('User is already an admin');
    }

    await supabase.from('study_group_members').update({ role: 'admin' }).eq('id', (membership as any).id);
  }

  async removeAdmin(groupId: string, removerId: string, adminId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const group = await this.getGroupRow(groupId);
    if (group.creator_id !== removerId) {
      throw new Error('Only group creator can remove admins');
    }
    if (group.creator_id === adminId) {
      throw new Error('Cannot remove creator admin status');
    }

    await supabase
      .from('study_group_members')
      .update({ role: 'member' })
      .eq('group_id', groupId)
      .eq('user_id', adminId);
  }

  async searchGroups(
    query: string,
    userId: string,
    filters?: { ieltsType?: 'academic' | 'general'; targetCountry?: string },
    limit: number = 20
  ) {
    const supabase = getSupabaseAdmin();
    const q = query?.trim() || '';

    const { data: memberships } = await supabase.from('study_group_members').select('group_id').eq('user_id', userId);
    const exclude = new Set<string>((memberships || []).map((m: any) => m.group_id));

    let request = supabase
      .from('study_groups')
      .select('id, name, description, avatar, creator_id, max_members, settings, metadata, created_at, updated_at')
      .ilike('name', `%${q}%`)
      .limit(limit);

    request = request.eq('settings->>isPrivate', 'false');

    if (filters?.ieltsType) {
      request = request.eq('metadata->>ieltsType', filters.ieltsType);
    }
    if (filters?.targetCountry) {
      request = request.eq('metadata->>targetCountry', filters.targetCountry);
    }

    const { data: groups } = await request;
    const rows = (groups || []) as StudyGroupRow[];
    const filtered = rows.filter(r => !exclude.has(r.id));

    const result = [];
    for (const row of filtered) {
      result.push(await this.buildGroupResponse(row, userId));
    }
    return result;
  }

  async getSuggestedGroups(userId: string, limit: number = 10) {
    const supabase = getSupabaseAdmin();
    const { data: me } = await supabase
      .from('user_profiles')
      .select('ielts_info, study_goals')
      .eq('user_id', userId)
      .maybeSingle();

    const meType = (me as any)?.ielts_info?.type;
    const meCountry = (me as any)?.study_goals?.targetCountry;

    const { data: memberships } = await supabase.from('study_group_members').select('group_id').eq('user_id', userId);
    const exclude = new Set<string>((memberships || []).map((m: any) => m.group_id));

    let req = supabase
      .from('study_groups')
      .select('id, name, description, avatar, creator_id, max_members, settings, metadata, created_at, updated_at')
      .eq('settings->>isPrivate', 'false')
      .limit(Math.min(50, Math.max(limit * 5, 20)));

    if (meType) {
      req = req.eq('metadata->>ieltsType', meType);
    }
    if (meCountry) {
      req = req.eq('metadata->>targetCountry', meCountry);
    }

    const { data: groups } = await req;
    const rows = (groups || []) as StudyGroupRow[];
    const filtered = rows.filter(r => !exclude.has(r.id));

    const result = [];
    for (const row of filtered.slice(0, limit)) {
      result.push(await this.buildGroupResponse(row, userId));
    }
    return result;
  }
}

export const studyGroupService = new StudyGroupService();

