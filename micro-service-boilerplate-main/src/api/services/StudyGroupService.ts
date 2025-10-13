import { Types } from 'mongoose';
import { Logger } from '../../lib/logger';
import { IStudyGroup, IStudyGroupInvite, StudyGroup, StudyGroupInvite } from '../models/StudyGroupModel';
import { UserProfile } from '../models/UserProfileModel';

const log = new Logger(__filename);

export class StudyGroupService {
  /**
   * Create a new study group
   */
  async createGroup(
    creatorId: string,
    name: string,
    description?: string,
    metadata?: any,
    settings?: any
  ): Promise<IStudyGroup> {
    const group = new StudyGroup({
      name,
      description,
      creatorId: new Types.ObjectId(creatorId),
      adminIds: [new Types.ObjectId(creatorId)],
      memberIds: [new Types.ObjectId(creatorId)],
      metadata: metadata || {},
      settings: settings || {
        isPrivate: false,
        allowMemberInvites: true,
        requireApproval: false
      }
    });

    await group.save();
    log.info(`Study group created: ${group._id} by ${creatorId}`);
    return group;
  }

  /**
   * Get group details
   */
  async getGroup(groupId: string): Promise<IStudyGroup | null> {
    return await StudyGroup.findById(groupId)
      .populate('creatorId', 'name email')
      .populate('memberIds', 'name email')
      .populate('adminIds', 'name email');
  }

  /**
   * Update group settings
   */
  async updateGroup(groupId: string, userId: string, updates: Partial<IStudyGroup>): Promise<IStudyGroup> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if user is admin
    if (!this.isAdmin(group, userId)) {
      throw new Error('Only admins can update group settings');
    }

    // Update allowed fields
    if (updates.name) group.name = updates.name;
    if (updates.description !== undefined) group.description = updates.description;
    if (updates.avatar !== undefined) group.avatar = updates.avatar;
    if (updates.settings) {
      group.settings = { ...group.settings, ...updates.settings };
    }
    if (updates.metadata) {
      group.metadata = { ...group.metadata, ...updates.metadata };
    }

    return await group.save();
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Only creator can delete group
    if (group.creatorId.toString() !== userId) {
      throw new Error('Only group creator can delete the group');
    }

    await StudyGroup.findByIdAndDelete(groupId);

    // Delete all pending invites for this group
    await StudyGroupInvite.deleteMany({ groupId: new Types.ObjectId(groupId) });

    log.info(`Study group deleted: ${groupId}`);
  }

  /**
   * Invite member to group
   */
  async inviteMember(
    groupId: string,
    inviterId: string,
    inviteeId: string,
    message?: string
  ): Promise<IStudyGroupInvite> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if group is full
    if (group.memberIds.length >= group.maxMembers) {
      throw new Error('Group is full');
    }

    // Check if inviter has permission
    const isAdmin = this.isAdmin(group, inviterId);
    const canInvite = isAdmin || group.settings.allowMemberInvites;

    if (!canInvite) {
      throw new Error('You do not have permission to invite members');
    }

    // Check if user is already a member
    if (group.memberIds.some(id => id.toString() === inviteeId)) {
      throw new Error('User is already a member');
    }

    // Check if invitation already exists
    const existingInvite = await StudyGroupInvite.findOne({
      groupId: new Types.ObjectId(groupId),
      inviteeId: new Types.ObjectId(inviteeId),
      status: 'pending'
    });

    if (existingInvite) {
      throw new Error('Invitation already sent');
    }

    // Create invitation
    const invite = new StudyGroupInvite({
      groupId: new Types.ObjectId(groupId),
      inviterId: new Types.ObjectId(inviterId),
      inviteeId: new Types.ObjectId(inviteeId),
      message,
      status: 'pending'
    });

    await invite.save();
    log.info(`Group invite sent: ${inviteeId} to group ${groupId}`);
    return invite;
  }

  /**
   * Accept group invitation
   */
  async acceptInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await StudyGroupInvite.findById(inviteId);

    if (!invite) {
      throw new Error('Invitation not found');
    }

    if (invite.inviteeId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    if (invite.status !== 'pending') {
      throw new Error('Invitation is not pending');
    }

    const group = await StudyGroup.findById(invite.groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if group is full
    if (group.memberIds.length >= group.maxMembers) {
      throw new Error('Group is full');
    }

    // Add user to group
    group.memberIds.push(new Types.ObjectId(userId));
    await group.save();

    // Update invite status
    invite.status = 'accepted';
    await invite.save();

    log.info(`User ${userId} joined group ${group._id}`);
  }

  /**
   * Decline group invitation
   */
  async declineInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await StudyGroupInvite.findById(inviteId);

    if (!invite) {
      throw new Error('Invitation not found');
    }

    if (invite.inviteeId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    invite.status = 'declined';
    await invite.save();
  }

  /**
   * Remove member from group
   */
  async removeMember(groupId: string, adminId: string, memberId: string): Promise<void> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if requester is admin
    if (!this.isAdmin(group, adminId)) {
      throw new Error('Only admins can remove members');
    }

    // Cannot remove creator
    if (group.creatorId.toString() === memberId) {
      throw new Error('Cannot remove group creator');
    }

    // Remove member
    group.memberIds = group.memberIds.filter(id => id.toString() !== memberId);

    // Remove from admins if applicable
    group.adminIds = group.adminIds.filter(id => id.toString() !== memberId);

    await group.save();
    log.info(`Member ${memberId} removed from group ${groupId}`);
  }

  /**
   * Leave group
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Creator cannot leave, must delete group instead
    if (group.creatorId.toString() === userId) {
      throw new Error('Creator cannot leave group. Delete the group instead.');
    }

    // Remove member
    group.memberIds = group.memberIds.filter(id => id.toString() !== userId);
    group.adminIds = group.adminIds.filter(id => id.toString() !== userId);

    await group.save();
    log.info(`User ${userId} left group ${groupId}`);
  }

  /**
   * Promote member to admin
   */
  async promoteToAdmin(groupId: string, promoterId: string, memberId: string): Promise<void> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Only creator or existing admins can promote
    if (!this.isAdmin(group, promoterId)) {
      throw new Error('Only admins can promote members');
    }

    // Check if user is a member
    if (!group.memberIds.some(id => id.toString() === memberId)) {
      throw new Error('User is not a member of this group');
    }

    // Check if already admin
    if (group.adminIds.some(id => id.toString() === memberId)) {
      throw new Error('User is already an admin');
    }

    // Promote to admin
    group.adminIds.push(new Types.ObjectId(memberId));
    await group.save();

    log.info(`Member ${memberId} promoted to admin in group ${groupId}`);
  }

  /**
   * Remove admin privileges
   */
  async removeAdmin(groupId: string, removerId: string, adminId: string): Promise<void> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // Only creator can remove admins
    if (group.creatorId.toString() !== removerId) {
      throw new Error('Only group creator can remove admins');
    }

    // Cannot remove creator's admin status
    if (group.creatorId.toString() === adminId) {
      throw new Error('Cannot remove creator admin status');
    }

    // Remove admin
    group.adminIds = group.adminIds.filter(id => id.toString() !== adminId);
    await group.save();

    log.info(`Admin ${adminId} demoted in group ${groupId}`);
  }

  /**
   * Get user's groups
   */
  async getUserGroups(userId: string): Promise<IStudyGroup[]> {
    return await StudyGroup.find({
      memberIds: new Types.ObjectId(userId)
    })
      .populate('creatorId', 'name email')
      .sort({ createdAt: -1 });
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string): Promise<any[]> {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    const profiles = await UserProfile.find({
      userId: { $in: group.memberIds }
    })
      .populate('userId', 'name email')
      .select('userId username avatar bio lastActive');

    // Mark admins
    return profiles.map(profile => ({
      ...profile.toObject(),
      isAdmin: group.adminIds.some(id => id.toString() === profile.userId.toString()),
      isCreator: group.creatorId.toString() === profile.userId.toString()
    }));
  }

  /**
   * Get pending invitations for user
   */
  async getUserInvites(userId: string): Promise<IStudyGroupInvite[]> {
    return await StudyGroupInvite.find({
      inviteeId: new Types.ObjectId(userId),
      status: 'pending'
    })
      .populate('groupId')
      .populate('inviterId', 'name email')
      .sort({ createdAt: -1 });
  }

  /**
   * Search groups
   */
  async searchGroups(
    query: string,
    userId: string,
    filters?: {
      ieltsType?: 'academic' | 'general';
      targetCountry?: string;
    },
    limit: number = 20
  ): Promise<IStudyGroup[]> {
    const searchCriteria: any = {
      'settings.isPrivate': false,
      name: new RegExp(query, 'i'),
      memberIds: { $nin: [new Types.ObjectId(userId)] } // Exclude groups user is already in
    };

    // Apply filters
    if (filters?.ieltsType) {
      searchCriteria['metadata.ieltsType'] = filters.ieltsType;
    }

    if (filters?.targetCountry) {
      searchCriteria['metadata.targetCountry'] = filters.targetCountry;
    }

    return await StudyGroup.find(searchCriteria)
      .populate('creatorId', 'name email')
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  /**
   * Get suggested groups based on user profile
   */
  async getSuggestedGroups(userId: string, limit: number = 10): Promise<IStudyGroup[]> {
    const userProfile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!userProfile) {
      return [];
    }

    // Get groups user is already in
    const userGroups = await this.getUserGroups(userId);
    const excludeGroupIds = userGroups.map(g => g._id);

    const matchCriteria: any = {
      _id: { $nin: excludeGroupIds },
      'settings.isPrivate': false,
      memberIds: { $nin: [new Types.ObjectId(userId)] }
    };

    // Match by IELTS type
    if (userProfile.ieltsInfo.type) {
      matchCriteria['metadata.ieltsType'] = userProfile.ieltsInfo.type;
    }

    // Match by target country
    if (userProfile.studyGoals.targetCountry) {
      matchCriteria['metadata.targetCountry'] = userProfile.studyGoals.targetCountry;
    }

    return await StudyGroup.find(matchCriteria).populate('creatorId', 'name email').limit(limit).sort({ memberIds: 1 }); // Prioritize groups with fewer members
  }

  /**
   * Check if user is admin
   */
  private isAdmin(group: IStudyGroup, userId: string): boolean {
    return group.adminIds.some(id => id.toString() === userId);
  }

  /**
   * Check if user is member
   */
  isMember(group: IStudyGroup, userId: string): boolean {
    return group.memberIds.some(id => id.toString() === userId);
  }
}

export const studyGroupService = new StudyGroupService();
