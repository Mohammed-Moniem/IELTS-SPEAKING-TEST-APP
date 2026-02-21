import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import { FriendRequest, FriendRequestStatus, Friendship, IFriendRequest } from '../models/FriendModel';
import { UserProfile } from '../models/UserProfileModel';

const log = new Logger(__filename);

export class FriendService {
  /**
   * Send a friend request
   */
  async sendFriendRequest(senderId: string, recipientId: string, message?: string): Promise<IFriendRequest> {
    // Check if request already exists
    const existing = await FriendRequest.findOne({
      $or: [
        { senderId: new Types.ObjectId(senderId), receiverId: new Types.ObjectId(recipientId) },
        { senderId: new Types.ObjectId(recipientId), receiverId: new Types.ObjectId(senderId) }
      ]
    });

    if (existing) {
      if (existing.status === FriendRequestStatus.PENDING) {
        throw new Error('Friend request already pending');
      } else if (existing.status === FriendRequestStatus.ACCEPTED) {
        throw new Error('Already friends');
      } else if (existing.status === FriendRequestStatus.BLOCKED) {
        throw new Error('Unable to send friend request');
      }

      // If declined, allow resending by updating the existing request
      existing.status = FriendRequestStatus.PENDING;
      existing.message = message;
      return await existing.save();
    }

    // Create new friend request
    const request = new FriendRequest({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(recipientId),
      status: FriendRequestStatus.PENDING,
      message
    });

    return await request.save();
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    const request = await FriendRequest.findById(requestId);

    if (!request) {
      throw new Error('Friend request not found');
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw new Error('Friend request is not pending');
    }

    // Update request status
    request.status = FriendRequestStatus.ACCEPTED;
    request.acceptedAt = new Date();
    await request.save();

    // Create friendship (both directions for easy lookup)
    const friendship = new Friendship({
      user1Id: request.senderId,
      user2Id: request.receiverId
    });

    await friendship.save();

    log.info(`Friend request accepted: ${request.senderId} <-> ${request.receiverId}`);
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<void> {
    const request = await FriendRequest.findById(requestId);

    if (!request) {
      throw new Error('Friend request not found');
    }

    request.status = FriendRequestStatus.DECLINED;
    await request.save();
  }

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    // Update any existing requests
    await FriendRequest.updateMany(
      {
        $or: [
          { senderId: new Types.ObjectId(blockerId), receiverId: new Types.ObjectId(blockedId) },
          { senderId: new Types.ObjectId(blockedId), receiverId: new Types.ObjectId(blockerId) }
        ]
      },
      { status: FriendRequestStatus.BLOCKED }
    );

    // Remove friendship if exists
    await Friendship.deleteMany({
      $or: [
        { user1Id: new Types.ObjectId(blockerId), user2Id: new Types.ObjectId(blockedId) },
        { user1Id: new Types.ObjectId(blockedId), user2Id: new Types.ObjectId(blockerId) }
      ]
    });

    // Create blocked request record
    const existingBlock = await FriendRequest.findOne({
      senderId: new Types.ObjectId(blockerId),
      receiverId: new Types.ObjectId(blockedId)
    });

    if (!existingBlock) {
      await FriendRequest.create({
        senderId: new Types.ObjectId(blockerId),
        receiverId: new Types.ObjectId(blockedId),
        status: FriendRequestStatus.BLOCKED
      });
    }
  }

  /**
   * Remove a friend
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    // Remove friendship
    await Friendship.deleteMany({
      $or: [
        { user1Id: new Types.ObjectId(userId), user2Id: new Types.ObjectId(friendId) },
        { user1Id: new Types.ObjectId(friendId), user2Id: new Types.ObjectId(userId) }
      ]
    });

    // Update friend request status if exists
    await FriendRequest.updateMany(
      {
        $or: [
          { senderId: new Types.ObjectId(userId), receiverId: new Types.ObjectId(friendId) },
          { senderId: new Types.ObjectId(friendId), receiverId: new Types.ObjectId(userId) }
        ],
        status: FriendRequestStatus.ACCEPTED
      },
      { status: FriendRequestStatus.DECLINED }
    );
  }

  /**
   * Get user's friends list
   */
  async getFriends(userId: string): Promise<any[]> {
    const friendships = await Friendship.find({
      $or: [{ user1Id: new Types.ObjectId(userId) }, { user2Id: new Types.ObjectId(userId) }]
    });

    // Extract friend IDs
    const friendIds = friendships.map(f => {
      return f.user1Id.toString() === userId ? f.user2Id : f.user1Id;
    });

    // Get friend profiles
    const profiles = await UserProfile.find({
      userId: { $in: friendIds }
    })
      .select('userId username avatar bio lastActive')
      .populate('userId', 'firstName lastName email')
      .lean();

    // Convert userId ObjectId to string for proper serialization
    return profiles.map(profile => ({
      ...profile,
      userId: profile.userId?._id?.toString() || profile.userId
    }));
  }

  /**
   * Get pending friend requests (received)
   */
  async getPendingRequests(userId: string): Promise<IFriendRequest[]> {
    return await FriendRequest.find({
      receiverId: new Types.ObjectId(userId),
      status: FriendRequestStatus.PENDING
    })
      .populate('senderId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get sent friend requests
   */
  async getSentRequests(userId: string): Promise<IFriendRequest[]> {
    return await FriendRequest.find({
      senderId: new Types.ObjectId(userId),
      status: FriendRequestStatus.PENDING
    })
      .populate('receiverId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(userId: string): Promise<string[]> {
    const blocked = await FriendRequest.find({
      senderId: new Types.ObjectId(userId),
      status: FriendRequestStatus.BLOCKED
    }).select('receiverId');

    return blocked.map(b => b.receiverId.toString());
  }

  /**
   * Get relationship status between two users
   */
  async getRelationshipStatus(
    requesterId: string,
    targetUserId: string
  ): Promise<{
    isFriend: boolean;
    hasPendingRequest: boolean;
    pendingDirection: 'outgoing' | 'incoming' | null;
  }> {
    if (!Types.ObjectId.isValid(requesterId) || !Types.ObjectId.isValid(targetUserId)) {
      throw new Error('Invalid user identifier');
    }

    const requesterObjectId = new Types.ObjectId(requesterId);
    const targetObjectId = new Types.ObjectId(targetUserId);

    const friendship = await Friendship.findOne({
      $or: [
        { user1Id: requesterObjectId, user2Id: targetObjectId },
        { user1Id: targetObjectId, user2Id: requesterObjectId }
      ]
    });

    const pendingRequest = await FriendRequest.findOne({
      status: FriendRequestStatus.PENDING,
      $or: [
        { senderId: requesterObjectId, receiverId: targetObjectId },
        { senderId: targetObjectId, receiverId: requesterObjectId }
      ]
    });

    let pendingDirection: 'outgoing' | 'incoming' | null = null;

    if (pendingRequest) {
      pendingDirection =
        pendingRequest.senderId.toString() === requesterId ? 'outgoing' : 'incoming';
    }

    return {
      isFriend: !!friendship,
      hasPendingRequest: !!pendingRequest,
      pendingDirection
    };
  }

  /**
   * Check if users are friends
   */
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
      log.warn(`areFriends called with invalid ObjectId(s): userId1=${userId1}, userId2=${userId2}`);
      return false;
    }

    const user1ObjectId = new Types.ObjectId(userId1);
    const user2ObjectId = new Types.ObjectId(userId2);

    const friendship = await Friendship.findOne({
      $or: [
        { user1Id: user1ObjectId, user2Id: user2ObjectId },
        { user1Id: user2ObjectId, user2Id: user1ObjectId }
      ]
    });

    if (!friendship) {
      log.warn(`No friendship found between users ${userId1} and ${userId2}`);
    }

    return !!friendship;
  }

  /**
   * Search users by username or email
   */
  async searchUsers(query: string, currentUserId: string, limit: number = 20): Promise<any[]> {
    const regex = new RegExp(query, 'i');

    // Get blocked users
    const blockedIds = await this.getBlockedUsers(currentUserId);

    const profiles = await UserProfile.find({
      $and: [
        {
          $or: [{ username: regex }, { 'userId.email': regex }]
        },
        {
          userId: {
            $ne: new Types.ObjectId(currentUserId),
            $nin: blockedIds.map(id => new Types.ObjectId(id))
          }
        },
        {
          'privacy.profileVisibility': { $ne: 'private' }
        }
      ]
    })
      .populate('userId', 'firstName lastName email')
      .select('userId username avatar bio')
      .limit(limit)
      .lean();

    // Convert userId ObjectId to string for proper serialization
    return profiles.map(profile => ({
      ...profile,
      userId: profile.userId?._id?.toString() || profile.userId
    }));
  }

  /**
   * Get friend suggestions based on user profile
   */
  async getFriendSuggestions(userId: string, limit: number = 10): Promise<any[]> {
    const userProfile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!userProfile || !userProfile.social.allowFriendSuggestions) {
      return [];
    }

    // Get current friends and blocked users
    const friendIds = (await this.getFriends(userId)).map(f => f.userId.toString());
    const blockedIds = await this.getBlockedUsers(userId);
    const excludeIds = [...friendIds, ...blockedIds, userId];

    // Build match criteria based on user's profile
    const matchCriteria: any = {
      userId: { $nin: excludeIds.map(id => new Types.ObjectId(id)) },
      'privacy.profileVisibility': 'public',
      'social.allowFriendSuggestions': true
    };

    // Match by IELTS type
    if (userProfile.ieltsInfo.type) {
      matchCriteria['ieltsInfo.type'] = userProfile.ieltsInfo.type;
    }

    // Match by target country
    if (userProfile.studyGoals.targetCountry) {
      matchCriteria['studyGoals.targetCountry'] = userProfile.studyGoals.targetCountry;
    }

    // Match by purpose
    if (userProfile.studyGoals.purpose) {
      matchCriteria['studyGoals.purpose'] = userProfile.studyGoals.purpose;
    }

    const suggestions = await UserProfile.find(matchCriteria)
      .populate('userId', 'firstName lastName email')
      .select('userId username avatar bio ieltsInfo studyGoals')
      .limit(limit)
      .sort({ lastActive: -1 }) // Prioritize active users
      .lean();

    // Convert userId ObjectId to string for proper serialization
    return suggestions.map(profile => ({
      ...profile,
      userId: profile.userId?._id?.toString() || profile.userId
    }));
  }

  /**
   * Get mutual friends count
   */
  async getMutualFriendsCount(userId1: string, userId2: string): Promise<number> {
    const user1Friends = (await this.getFriends(userId1)).map(f => f.userId.toString());
    const user2Friends = (await this.getFriends(userId2)).map(f => f.userId.toString());

    const mutualFriends = user1Friends.filter(id => user2Friends.includes(id));
    return mutualFriends.length;
  }
}

export const friendService = new FriendService();
