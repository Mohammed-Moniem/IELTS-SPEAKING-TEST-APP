import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import { Friendship } from '../models/FriendModel';
import { IStudyGroup, IStudyGroupInvite, StudyGroup, StudyGroupInvite } from '../models/StudyGroupModel';
import { UserProfile } from '../models/UserProfileModel';

const log = new Logger(__filename);

export class StudyGroupService {
  private readonly MAX_MEMBERS = 10;

  private async getFriendIdsSet(userId: string): Promise<Set<string>> {
    const objectId = new Types.ObjectId(userId);
    const friendships = await Friendship.find({
      $or: [{ user1Id: objectId }, { user2Id: objectId }]
    });

    const friendIds = new Set<string>();
    friendships.forEach(friendship => {
      if (friendship.user1Id.toString() === userId) {
        friendIds.add(friendship.user2Id.toString());
      } else {
        friendIds.add(friendship.user1Id.toString());
      }
    });

    return friendIds;
  }

  private async ensureFriends(userId: string, candidateIds: string[]): Promise<void> {
    if (!candidateIds.length) {
      return;
    }

    const friendIdSet = await this.getFriendIdsSet(userId);
    const notFriends = candidateIds.filter(id => !friendIdSet.has(id));

    if (notFriends.length) {
      throw new Error('You can only add friends to the study group');
    }
  }

  private enforceMaxMembers(group: IStudyGroup) {
    if (!group.maxMembers || group.maxMembers > this.MAX_MEMBERS) {
      group.maxMembers = this.MAX_MEMBERS;
    }
  }

  private buildGroupResponse(group: IStudyGroup, userId: string) {
    this.enforceMaxMembers(group);
    const groupObj = group.toObject();
    const normalizedMemberIds = group.memberIds.map(id => id.toString());
    const normalizedAdminIds = group.adminIds.map(id => id.toString());
    const normalizedCreatorId = group.creatorId.toString();

    return {
      ...groupObj,
      _id: groupObj._id?.toString?.() ?? group._id.toString(),
      creatorId: normalizedCreatorId,
      adminIds: normalizedAdminIds,
      memberIds: normalizedMemberIds,
      memberCount: normalizedMemberIds.length,
      maxMembers: group.maxMembers,
      isCreator: normalizedCreatorId === userId,
      isAdmin: normalizedAdminIds.includes(userId)
    };
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
    const sanitizedInitialMembers = Array.from(
      new Set(
        (initialMemberIds || [])
          .map(id => id && id.toString())
          .filter(id => id && id !== creatorId)
      )
    );

    await this.ensureFriends(creatorId, sanitizedInitialMembers);

    if (sanitizedInitialMembers.length + 1 > this.MAX_MEMBERS) {
      throw new Error(`A study group can have at most ${this.MAX_MEMBERS} members`);
    }

    const group = new StudyGroup({
      name,
      description,
      creatorId: new Types.ObjectId(creatorId),
      adminIds: [new Types.ObjectId(creatorId)],
      memberIds: [new Types.ObjectId(creatorId), ...sanitizedInitialMembers.map(id => new Types.ObjectId(id))],
      maxMembers: this.MAX_MEMBERS,
      metadata: metadata || {},
      settings: {
        isPrivate: settings?.isPrivate ?? false,
        allowMemberInvites: false,
        requireApproval: settings?.requireApproval ?? false
      }
    });

    this.enforceMaxMembers(group);
    await group.save();
    log.info(`Study group created: ${group._id} by ${creatorId}`);
    return this.buildGroupResponse(group, creatorId);
  }

  /**
   * Get group details
   */
  async getGroup(groupId: string, userId: string) {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    return this.buildGroupResponse(group, userId);
  }

  /**
   * Update group settings
   */
  async updateGroup(groupId: string, userId: string, updates: Partial<IStudyGroup>) {
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
      group.settings.allowMemberInvites = false;
    }
    if (updates.metadata) {
      group.metadata = { ...group.metadata, ...updates.metadata };
    }

    this.enforceMaxMembers(group);

    const savedGroup = await group.save();
    return this.buildGroupResponse(savedGroup, userId);
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

    this.enforceMaxMembers(group);

    // Check if group is full
    if (group.memberIds.length >= group.maxMembers) {
      throw new Error('Group is full');
    }

    // Only admins can invite
    if (!this.isAdmin(group, inviterId)) {
      throw new Error('Only admins can invite members');
    }

    await this.ensureFriends(inviterId, [inviteeId]);

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

  async addMember(groupId: string, adminId: string, memberId: string) {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    if (!this.isAdmin(group, adminId)) {
      throw new Error('Only admins can add members');
    }

    this.enforceMaxMembers(group);

    if (group.memberIds.length >= group.maxMembers) {
      throw new Error('Group is full');
    }

    if (group.memberIds.some(id => id.toString() === memberId)) {
      throw new Error('User is already a member');
    }

    await this.ensureFriends(adminId, [memberId]);

    group.memberIds.push(new Types.ObjectId(memberId));
    await group.save();

    await StudyGroupInvite.deleteMany({
      groupId: group._id,
      inviteeId: new Types.ObjectId(memberId)
    });

    log.info(`Member ${memberId} added to group ${groupId} by admin ${adminId}`);
    return this.buildGroupResponse(group, adminId);
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

    this.enforceMaxMembers(group);

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

  async joinGroup(groupId: string, userId: string) {
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    this.enforceMaxMembers(group);

    if (group.settings.isPrivate) {
      throw new Error('This group is private. Ask an admin to add you.');
    }

    if (group.memberIds.some(id => id.toString() === userId)) {
      throw new Error('You are already a member of this group');
    }

    if (group.memberIds.length >= group.maxMembers) {
      throw new Error('Group is full');
    }

    group.memberIds.push(new Types.ObjectId(userId));
    await group.save();

    log.info(`User ${userId} joined public group ${groupId}`);
    return this.buildGroupResponse(group, userId);
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
  async getUserGroups(userId: string) {
    const groups = await StudyGroup.find({
      memberIds: new Types.ObjectId(userId)
    }).sort({ createdAt: -1 });

    return groups.map(group => this.buildGroupResponse(group, userId));
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
      .populate('userId', 'email firstName lastName')
      .select('userId username avatar bio lastActive');

    return profiles.map(profile => {
      const profileObj = profile.toObject() as any;
      const userDoc = profileObj.userId;
      const userId = userDoc?._id ? userDoc._id.toString() : profile.userId.toString();
      const displayName = [userDoc?.firstName, userDoc?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      return {
        id: profileObj._id,
        userId,
        username: profileObj.username,
        avatar: profileObj.avatar,
        bio: profileObj.bio,
        lastActive: profileObj.lastActive,
        email: userDoc?.email,
        displayName: displayName || profileObj.username || userDoc?.email,
        isAdmin: group.adminIds.some(id => id.toString() === userId),
        isCreator: group.creatorId.toString() === userId
      };
    });
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

    const groups = await StudyGroup.find(searchCriteria).limit(limit).sort({ createdAt: -1 });
    return groups.map(group => this.buildGroupResponse(group, userId));
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
    const excludeGroupIds = userGroups.map(g => new Types.ObjectId(g._id));

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

    const groups = await StudyGroup.find(matchCriteria).limit(limit).sort({ memberIds: 1 });
    return groups.map(group => this.buildGroupResponse(group, userId));
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
