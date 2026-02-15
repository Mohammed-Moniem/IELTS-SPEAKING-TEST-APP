import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '../../lib/logger';

const log = new Logger(__filename);

type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'blocked';

type FriendRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type FriendshipRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
};

type UserBasics = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  lastActive?: string;
  isOnline?: boolean;
};

function normalizePair(a: string, b: string): { user1: string; user2: string } {
  return a < b ? { user1: a, user2: b } : { user1: b, user2: a };
}

async function getUsersBasics(userIds: string[]): Promise<Map<string, UserBasics>> {
  const supabase = getSupabaseAdmin();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, UserBasics>();
  unique.forEach(id => map.set(id, { id }));

  if (!unique.length) {
    return map;
  }

  const [{ data: profiles }, { data: socialProfiles }, { data: statuses }] = await Promise.all([
    supabase.from('profiles').select('id, email, first_name, last_name').in('id', unique),
    supabase.from('user_profiles').select('user_id, username, avatar, bio, last_active').in('user_id', unique),
    supabase.from('user_status').select('user_id, is_online, last_seen').in('user_id', unique)
  ]);

  (profiles || []).forEach((row: any) => {
    const entry = map.get(row.id) || { id: row.id };
    entry.email = row.email;
    entry.firstName = row.first_name;
    entry.lastName = row.last_name;
    map.set(row.id, entry);
  });

  (socialProfiles || []).forEach((row: any) => {
    const userId = row.user_id;
    const entry = map.get(userId) || { id: userId };
    entry.username = row.username;
    entry.avatar = row.avatar || undefined;
    entry.bio = row.bio || undefined;
    entry.lastActive = row.last_active || undefined;
    map.set(userId, entry);
  });

  (statuses || []).forEach((row: any) => {
    const userId = row.user_id;
    const entry = map.get(userId) || { id: userId };
    entry.isOnline = Boolean(row.is_online);
    map.set(userId, entry);
  });

  return map;
}

export class FriendService {
  /**
   * Send a friend request
   */
  async sendFriendRequest(senderId: string, recipientId: string, message?: string): Promise<any> {
    if (!senderId || !recipientId) {
      throw new Error('recipientId is required');
    }
    if (senderId === recipientId) {
      throw new Error('Cannot send friend request to yourself');
    }

    const supabase = getSupabaseAdmin();

    // Block check in either direction.
    const { data: blockedRows } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${senderId})`
      )
      .eq('status', 'blocked')
      .limit(2);

    if (blockedRows && blockedRows.length) {
      throw new Error('Unable to send friend request');
    }

    // Already friends?
    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(user1_id.eq.${senderId},user2_id.eq.${recipientId}),and(user1_id.eq.${recipientId},user2_id.eq.${senderId})`
      )
      .maybeSingle();

    if (friendship) {
      throw new Error('Already friends');
    }

    // Pending request exists?
    const { data: pending } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${senderId})`
      )
      .eq('status', 'pending')
      .limit(2);

    if (pending && pending.length) {
      throw new Error('Friend request already pending');
    }

    // Clean up any declined/cancelled requests between the two users so direction stays correct.
    await supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${senderId})`
      )
      .in('status', ['declined', 'cancelled']);

    const { data: inserted, error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: recipientId,
        status: 'pending',
        message: message || null
      })
      .select('id, sender_id, receiver_id, status, message, created_at, updated_at')
      .single();

    if (error || !inserted) {
      log.error('Failed to create friend request', { error: error?.message || error });
      throw new Error('Failed to send friend request');
    }

    const basics = await getUsersBasics([senderId, recipientId]);
    const sender = basics.get(senderId);
    const receiver = basics.get(recipientId);

    return {
      _id: inserted.id,
      senderId: {
        _id: senderId,
        email: sender?.email,
        username: sender?.username
      },
      receiverId: {
        _id: recipientId,
        email: receiver?.email,
        firstName: receiver?.firstName,
        lastName: receiver?.lastName
      },
      status: inserted.status,
      message: inserted.message || undefined,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at
    };
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: request, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (error || !request) {
      throw new Error('Friend request not found');
    }
    if ((request as any).status !== 'pending') {
      throw new Error('Friend request is not pending');
    }

    const senderId = (request as any).sender_id as string;
    const receiverId = (request as any).receiver_id as string;

    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);

    const pair = normalizePair(senderId, receiverId);
    await supabase
      .from('friendships')
      .insert({ user1_id: pair.user1, user2_id: pair.user2 })
      .throwOnError();
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: request, error } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (error || !request) {
      throw new Error('Friend request not found');
    }

    await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', requestId);
  }

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself');
    }

    const supabase = getSupabaseAdmin();

    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user1_id.eq.${blockerId},user2_id.eq.${blockedId}),and(user1_id.eq.${blockedId},user2_id.eq.${blockerId})`
      );

    await supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`
      );

    await supabase
      .from('friend_requests')
      .insert({
        sender_id: blockerId,
        receiver_id: blockedId,
        status: 'blocked'
      })
      .throwOnError();
  }

  /**
   * Remove a friend
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('friendships')
      .delete()
      .or(`and(user1_id.eq.${userId},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${userId})`);

    await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`);
  }

  /**
   * Get user's friends list
   */
  async getFriends(userId: string): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, user1_id, user2_id, created_at')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (error) {
      throw new Error('Failed to load friends');
    }

    const rows = (friendships || []) as FriendshipRow[];
    const friendIds = rows
      .map(row => (row.user1_id === userId ? row.user2_id : row.user1_id))
      .filter(Boolean);

    const basics = await getUsersBasics(friendIds);

    return friendIds.map(friendId => {
      const b = basics.get(friendId);
      return {
        _id: friendId,
        userId: friendId,
        username: b?.username,
        avatar: b?.avatar,
        bio: b?.bio,
        lastActive: b?.lastActive,
        friendId: {
          _id: friendId,
          email: b?.email,
          username: b?.username,
          avatar: b?.avatar,
          isOnline: Boolean(b?.isOnline)
        },
        becameFriendsAt: rows.find(r => (r.user1_id === userId ? r.user2_id : r.user1_id) === friendId)?.created_at
      };
    });
  }

  /**
   * Get pending friend requests (received)
   */
  async getPendingRequests(userId: string): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, message, created_at, updated_at')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to load requests');
    }

    const rows = (data || []) as FriendRequestRow[];
    const basics = await getUsersBasics(rows.flatMap(r => [r.sender_id, r.receiver_id]));

    return rows.map(row => {
      const sender = basics.get(row.sender_id);
      const receiver = basics.get(row.receiver_id);
      return {
        _id: row.id,
        senderId: {
          _id: row.sender_id,
          email: sender?.email,
          username: sender?.username
        },
        receiverId: {
          _id: row.receiver_id,
          email: receiver?.email,
          firstName: receiver?.firstName,
          lastName: receiver?.lastName
        },
        status: row.status,
        message: row.message || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  /**
   * Get sent friend requests
   */
  async getSentRequests(userId: string): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, message, created_at, updated_at')
      .eq('sender_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to load sent requests');
    }

    const rows = (data || []) as FriendRequestRow[];
    const basics = await getUsersBasics(rows.flatMap(r => [r.sender_id, r.receiver_id]));

    return rows.map(row => {
      const sender = basics.get(row.sender_id);
      const receiver = basics.get(row.receiver_id);
      return {
        _id: row.id,
        senderId: {
          _id: row.sender_id,
          email: sender?.email,
          username: sender?.username
        },
        receiverId: {
          _id: row.receiver_id,
          email: receiver?.email,
          firstName: receiver?.firstName,
          lastName: receiver?.lastName
        },
        status: row.status,
        message: row.message || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(userId: string): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', userId)
      .eq('status', 'blocked');

    if (error) {
      return [];
    }

    return (data || []).map((row: any) => row.receiver_id).filter(Boolean);
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
    const supabase = getSupabaseAdmin();

    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(user1_id.eq.${requesterId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${requesterId})`
      )
      .maybeSingle();

    const { data: pending } = await supabase
      .from('friend_requests')
      .select('id, sender_id')
      .or(
        `and(sender_id.eq.${requesterId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${requesterId})`
      )
      .eq('status', 'pending')
      .maybeSingle();

    const pendingDirection = pending ? ((pending as any).sender_id === requesterId ? 'outgoing' : 'incoming') : null;

    return {
      isFriend: Boolean(friendship),
      hasPendingRequest: Boolean(pending),
      pendingDirection
    };
  }

  /**
   * Check if users are friends
   */
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`)
      .maybeSingle();
    return Boolean(data);
  }

  /**
   * Search users by username or email
   */
  async searchUsers(query: string, currentUserId: string, limit: number = 20): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }

    const blockedIds = new Set(await this.getBlockedUsers(currentUserId));

    const { data: usernameMatches } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar')
      .ilike('username', `%${q}%`)
      .neq('user_id', currentUserId)
      .limit(limit);

    const { data: emailMatches } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', `%${q}%`)
      .neq('id', currentUserId)
      .limit(limit);

    const userIds = Array.from(
      new Set([
        ...(usernameMatches || []).map((row: any) => row.user_id),
        ...(emailMatches || []).map((row: any) => row.id)
      ])
    ).filter((id: string) => id && !blockedIds.has(id));

    if (!userIds.length) {
      return [];
    }

    const basics = await getUsersBasics(userIds);

    // Relationship: friends/pending
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

    const friendSet = new Set(
      (friendships || []).map((row: any) => (row.user1_id === currentUserId ? row.user2_id : row.user1_id))
    );

    const pendingSet = new Set<string>();
    const [{ data: outgoingPending }, { data: incomingPending }] = await Promise.all([
      supabase
        .from('friend_requests')
        .select('receiver_id')
        .eq('sender_id', currentUserId)
        .eq('status', 'pending')
        .in('receiver_id', userIds),
      supabase
        .from('friend_requests')
        .select('sender_id')
        .eq('receiver_id', currentUserId)
        .eq('status', 'pending')
        .in('sender_id', userIds)
    ]);

    (outgoingPending || []).forEach((row: any) => {
      if (row.receiver_id) pendingSet.add(row.receiver_id);
    });
    (incomingPending || []).forEach((row: any) => {
      if (row.sender_id) pendingSet.add(row.sender_id);
    });

    return userIds.slice(0, limit).map(id => {
      const b = basics.get(id);
      return {
        _id: id,
        email: b?.email,
        username: b?.username,
        avatar: b?.avatar,
        isFriend: friendSet.has(id),
        hasPendingRequest: pendingSet.has(id)
      };
    });
  }

  /**
   * Get friend suggestions based on user profile
   */
  async getFriendSuggestions(userId: string, limit: number = 10): Promise<any[]> {
    const supabase = getSupabaseAdmin();

    const { data: me } = await supabase
      .from('user_profiles')
      .select('user_id, ielts_info, study_goals, social, privacy')
      .eq('user_id', userId)
      .maybeSingle();

    const allow = (me as any)?.social?.allowFriendSuggestions;
    if (me && allow === false) {
      return [];
    }

    const friends = await this.getFriends(userId);
    const friendIds = friends.map(f => f.userId).filter(Boolean);
    const blockedIds = await this.getBlockedUsers(userId);
    const exclude = new Set<string>([userId, ...friendIds, ...blockedIds]);

    const { data: candidates } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar, ielts_info, study_goals, privacy, social')
      .neq('user_id', userId)
      .limit(Math.min(50, Math.max(limit * 5, 20)));

    const filtered = (candidates || []).filter((row: any) => {
      if (!row?.user_id || exclude.has(row.user_id)) return false;
      const visibility = row?.privacy?.profileVisibility || 'friends-only';
      if (visibility !== 'public') return false;
      if (row?.social?.allowFriendSuggestions === false) return false;
      return true;
    });

    const meType = (me as any)?.ielts_info?.type;
    const meCountry = (me as any)?.study_goals?.targetCountry;
    const mePurpose = (me as any)?.study_goals?.purpose;

    const scored = filtered.map((row: any) => {
      let score = 0;
      const reasons: string[] = [];

      if (meType && row?.ielts_info?.type === meType) {
        score += 40;
        reasons.push('Same IELTS type');
      }
      if (meCountry && row?.study_goals?.targetCountry === meCountry) {
        score += 35;
        reasons.push('Same target country');
      }
      if (mePurpose && row?.study_goals?.purpose === mePurpose) {
        score += 25;
        reasons.push('Similar goals');
      }

      return { row, score, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.max(1, limit)).map(entry => entry.row.user_id);

    const basics = await getUsersBasics(top);

    return scored
      .slice(0, Math.max(1, limit))
      .map(entry => {
        const id = entry.row.user_id as string;
        const b = basics.get(id);
        return {
          _id: id,
          email: b?.email,
          username: b?.username,
          avatar: b?.avatar,
          mutualFriends: 0,
          matchScore: entry.score,
          matchReasons: entry.reasons
        };
      })
      .filter(Boolean);
  }

  async getMutualFriendsCount(userId1: string, userId2: string): Promise<number> {
    const friends1 = (await this.getFriends(userId1)).map(f => f.userId);
    const friends2 = new Set((await this.getFriends(userId2)).map(f => f.userId));
    return friends1.filter((id: string) => friends2.has(id)).length;
  }
}

export const friendService = new FriendService();
