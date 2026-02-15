import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '@lib/logger';
import { randomUUID } from 'crypto';

import { encryptionService } from './EncryptionService';
import { friendService } from './FriendService';

const log = new Logger(__filename);

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string | null;
  group_id: string | null;
  encrypted_content: string;
  iv: string;
  message_type: string;
  is_edited: boolean;
  is_deleted: boolean;
  read_by: string[];
  delivered_to: string[];
  reactions: any;
  metadata: any;
  created_at: string;
  updated_at: string;
};

type ConversationRow = {
  conversation_id: string;
  participants: string[];
  is_group_chat: boolean;
  group_id: string | null;
  last_message: any | null;
  unread_count: any;
  created_at: string;
  updated_at: string;
};

type UserBasics = {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
};

type MappedMessage = {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'gif' | 'file' | 'system';
  mediaUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: any;
  sender?: any;
  recipient?: any;
  readBy: string[];
  deliveredTo: string[];
  isEdited: boolean;
  isDeleted: boolean;
  status?: string;
  createdAt: string;
  updatedAt: string;
  timestamp?: string;
};

type MappedConversation = {
  _id: string;
  conversationId: string;
  participants: Array<{ _id: string; email?: string; username?: string; avatar?: string }>;
  isGroupChat: boolean;
  lastMessage?: { preview: string; timestamp: string; senderId?: string };
  unreadCount: number;
  groupName?: string;
  groupId?: string;
  groupAvatar?: string;
  createdAt?: string;
  updatedAt?: string;
};

const toMessageType = (value: string | null | undefined): MappedMessage['messageType'] => {
  const v = (value || 'text').toString().toLowerCase();
  if (v === 'image' || v === 'audio' || v === 'video' || v === 'gif' || v === 'file' || v === 'system') {
    return v;
  }
  return 'text';
};

const safePreview = (text: string): string => {
  const safe = (text || '').trim();
  if (!safe) return '';
  return safe.length > 50 ? `${safe.slice(0, 50)}...` : safe;
};

const isIsoDate = (value: string): boolean => {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

const uniq = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)));

async function getUsersBasics(userIds: string[]): Promise<Map<string, UserBasics>> {
  const supabase = getSupabaseAdmin();
  const unique = uniq(userIds);
  if (!unique.length) return new Map();

  const [profilesRes, socialRes] = await Promise.all([
    supabase.from('profiles').select('id, email, first_name, last_name').in('id', unique),
    supabase.from('user_profiles').select('user_id, username, avatar').in('user_id', unique)
  ]);

  const map = new Map<string, UserBasics>();

  (profilesRes.data || []).forEach((row: any) => {
    map.set(row.id, {
      userId: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name
    });
  });

  (socialRes.data || []).forEach((row: any) => {
    const current = map.get(row.user_id) || { userId: row.user_id };
    map.set(row.user_id, {
      ...current,
      username: row.username,
      avatar: row.avatar
    });
  });

  return map;
}

async function createSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string | undefined> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      return undefined;
    }
    return data.signedUrl;
  } catch {
    return undefined;
  }
}

export class ChatService {
  /**
   * Send a direct message (1-on-1)
   */
  async sendDirectMessage(
    senderId: string,
    recipientId: string,
    content: string,
    messageType: 'text' | 'image' | 'audio' | 'video' | 'gif' | 'file' = 'text',
    metadata?: any
  ): Promise<ChatMessageRow> {
    const areFriends = await friendService.areFriends(senderId, recipientId);
    if (!areFriends) {
      throw new Error('Can only send messages to friends');
    }

    const { encryptedContent, iv } = encryptionService.encryptMessage(content);
    const conversationId = this.generateConversationId(senderId, recipientId);

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        group_id: null,
        encrypted_content: encryptedContent,
        iv,
        message_type: messageType,
        metadata: metadata || null,
        delivered_to: [recipientId],
        read_by: [senderId],
        created_at: now
      })
      .select(
        'id, conversation_id, sender_id, recipient_id, group_id, encrypted_content, iv, message_type, is_edited, is_deleted, read_by, delivered_to, reactions, metadata, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error('Failed to send message');
    }

    await this.updateConversationMetadata(conversationId, [senderId, recipientId], senderId, content, false);

    log.info(`Message sent from ${senderId} to ${recipientId}`);
    return data as unknown as ChatMessageRow;
  }

  /**
   * Send a group message
   */
  async sendGroupMessage(
    senderId: string,
    groupId: string,
    content: string,
    memberIds: string[],
    messageType: 'text' | 'image' | 'audio' | 'video' | 'gif' | 'file' = 'text',
    metadata?: any
  ): Promise<ChatMessageRow> {
    if (!memberIds.includes(senderId)) {
      throw new Error('Not a member of this group');
    }

    const { encryptedContent, iv } = encryptionService.encryptMessage(content);
    const conversationId = `group_${groupId}`;

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const deliveredTo = memberIds.filter(id => id !== senderId);

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: null,
        group_id: groupId,
        encrypted_content: encryptedContent,
        iv,
        message_type: messageType,
        metadata: metadata || null,
        delivered_to: deliveredTo,
        read_by: [senderId],
        created_at: now
      })
      .select(
        'id, conversation_id, sender_id, recipient_id, group_id, encrypted_content, iv, message_type, is_edited, is_deleted, read_by, delivered_to, reactions, metadata, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error('Failed to send group message');
    }

    await this.updateConversationMetadata(conversationId, memberIds, senderId, content, true, groupId);

    log.info(`Group message sent by ${senderId} in group ${groupId}`);
    return data as unknown as ChatMessageRow;
  }

  /**
   * Get conversation messages with pagination.
   * `before` should be an ISO timestamp of the oldest message currently loaded.
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    limit: number = 50,
    before?: string
  ): Promise<MappedMessage[]> {
    await this.assertConversationAccess(conversationId, userId);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('chat_messages')
      .select(
        'id, conversation_id, sender_id, recipient_id, group_id, encrypted_content, iv, message_type, is_edited, is_deleted, read_by, delivered_to, reactions, metadata, created_at, updated_at'
      )
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit || 50, 100)));

    if (before && isIsoDate(before)) {
      query = query.lt('created_at', new Date(before).toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error('Failed to load messages');
    }

    const rows = ((data || []) as unknown as ChatMessageRow[]).reverse();

    const userIds = uniq(
      rows.flatMap(row => [row.sender_id, row.recipient_id || undefined].filter(Boolean) as string[])
    );
    const basics = await getUsersBasics(userIds);

    const mapped: MappedMessage[] = [];
    for (const row of rows) {
      const plain = this.decryptMessageContent(row.encrypted_content, row.iv);
      const metadata = row.metadata || undefined;

      let mediaUrl: string | undefined;
      let thumbnailUrl: string | undefined;

      const bucket = metadata?.bucket as string | undefined;
      const path = metadata?.path as string | undefined;
      const thumbnailPath = metadata?.thumbnailPath as string | undefined;

      if (bucket && path) {
        mediaUrl = await createSignedUrl(bucket, path, 60 * 60);
      } else if (typeof metadata?.fileUrl === 'string') {
        mediaUrl = metadata.fileUrl;
      }

      if (bucket && thumbnailPath) {
        thumbnailUrl = await createSignedUrl(bucket, thumbnailPath, 60 * 60);
      } else if (typeof metadata?.thumbnailUrl === 'string') {
        thumbnailUrl = metadata.thumbnailUrl;
      }

      if (metadata && mediaUrl) {
        metadata.fileUrl = mediaUrl;
      }
      if (metadata && thumbnailUrl) {
        metadata.thumbnailUrl = thumbnailUrl;
      }

      const sender = basics.get(row.sender_id);
      const recipient = row.recipient_id ? basics.get(row.recipient_id) : undefined;

      mapped.push({
        _id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        recipientId: row.recipient_id || undefined,
        groupId: row.group_id || undefined,
        content: plain,
        messageType: toMessageType(row.message_type),
        mediaUrl,
        thumbnailUrl,
        fileSize: typeof metadata?.fileSize === 'number' ? metadata.fileSize : undefined,
        mimeType: typeof metadata?.mimeType === 'string' ? metadata.mimeType : undefined,
        metadata,
        sender: sender
          ? {
              _id: sender.userId,
              firstName: sender.firstName,
              lastName: sender.lastName,
              email: sender.email,
              username: sender.username,
              avatar: sender.avatar
            }
          : undefined,
        recipient: recipient
          ? {
              _id: recipient.userId,
              firstName: recipient.firstName,
              lastName: recipient.lastName,
              email: recipient.email,
              username: recipient.username,
              avatar: recipient.avatar
            }
          : undefined,
        readBy: Array.isArray(row.read_by) ? row.read_by : [],
        deliveredTo: Array.isArray(row.delivered_to) ? row.delivered_to : [],
        isEdited: Boolean(row.is_edited),
        isDeleted: Boolean(row.is_deleted),
        status: 'delivered',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        timestamp: row.created_at
      });
    }

    return mapped;
  }

  /**
   * Get user's conversations list.
   */
  async getUserConversations(userId: string): Promise<MappedConversation[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('conversations')
      .select('conversation_id, participants, is_group_chat, group_id, last_message, unread_count, created_at, updated_at')
      .contains('participants', [userId])
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      log.error('Error fetching user conversations:', error);
      throw new Error('Failed to load conversations');
    }

    const rows = (data || []) as unknown as ConversationRow[];
    const allUserIds = uniq(rows.flatMap(row => row.participants || []));
    const basics = await getUsersBasics(allUserIds);

    const groupIds = uniq(rows.map(r => r.group_id || '').filter(Boolean) as string[]);
    const groupById = new Map<string, { name?: string; avatar?: string }>();
    if (groupIds.length) {
      const { data: groups } = await supabase.from('study_groups').select('id, name, avatar').in('id', groupIds);
      (groups || []).forEach((g: any) => groupById.set(g.id, { name: g.name, avatar: g.avatar }));
    }

    return rows.map(row => {
      const unread = row.unread_count && typeof row.unread_count === 'object' ? row.unread_count[userId] : 0;
      const participants = (row.participants || []).map(pid => {
        const b = basics.get(pid);
        return {
          _id: pid,
          email: b?.email,
          username: b?.username,
          avatar: b?.avatar
        };
      });

      const group = row.group_id ? groupById.get(row.group_id) : undefined;
      const lastMessage = row.last_message
        ? {
            preview: row.last_message.preview,
            timestamp: row.last_message.timestamp,
            senderId: row.last_message.senderId
          }
        : undefined;

      return {
        _id: row.conversation_id,
        conversationId: row.conversation_id,
        participants,
        isGroupChat: Boolean(row.is_group_chat),
        lastMessage,
        unreadCount: Number(unread || 0),
        groupId: row.group_id || undefined,
        groupName: group?.name,
        groupAvatar: group?.avatar,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, recipient_id, group_id, read_by')
      .eq('id', messageId)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Message not found');
    }

    const row = data as any;
    await this.assertConversationAccess(row.conversation_id, userId);

    const readBy = uniq([...(Array.isArray(row.read_by) ? row.read_by : []), userId]);
    await supabase.from('chat_messages').update({ read_by: readBy }).eq('id', messageId);

    await this.decrementUnreadCount(row.conversation_id, userId, 1);
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    await this.assertConversationAccess(conversationId, userId);
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from('conversations')
      .select('conversation_id, unread_count')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!data) return;

    const unread = (data as any).unread_count && typeof (data as any).unread_count === 'object' ? (data as any).unread_count : {};
    unread[userId] = 0;
    await supabase.from('conversations').update({ unread_count: unread }).eq('conversation_id', conversationId);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .maybeSingle();

    if (!data) {
      throw new Error('Message not found');
    }

    if ((data as any).sender_id !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', messageId);
  }

  async editMessage(messageId: string, userId: string, newContent: string): Promise<ChatMessageRow> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('chat_messages')
      .select(
        'id, conversation_id, sender_id, recipient_id, group_id, encrypted_content, iv, message_type, is_edited, is_deleted, read_by, delivered_to, reactions, metadata, created_at, updated_at'
      )
      .eq('id', messageId)
      .maybeSingle();

    if (!data) {
      throw new Error('Message not found');
    }

    const row = data as unknown as ChatMessageRow;
    if (row.sender_id !== userId) {
      throw new Error('Unauthorized to edit this message');
    }

    if (toMessageType(row.message_type) !== 'text') {
      throw new Error('Only text messages can be edited');
    }

    const { encryptedContent, iv } = encryptionService.encryptMessage(newContent);
    const { data: updated, error } = await supabase
      .from('chat_messages')
      .update({
        encrypted_content: encryptedContent,
        iv,
        is_edited: true
      })
      .eq('id', messageId)
      .select(
        'id, conversation_id, sender_id, recipient_id, group_id, encrypted_content, iv, message_type, is_edited, is_deleted, read_by, delivered_to, reactions, metadata, created_at, updated_at'
      )
      .single();

    if (error || !updated) {
      throw new Error('Failed to update message');
    }

    return updated as unknown as ChatMessageRow;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('conversations')
      .select('conversation_id, unread_count')
      .contains('participants', [userId])
      .limit(500);

    if (error) {
      return 0;
    }

    let total = 0;
    (data || []).forEach((row: any) => {
      const count = row?.unread_count && typeof row.unread_count === 'object' ? Number(row.unread_count[userId] || 0) : 0;
      total += count;
    });

    return total;
  }

  async searchMessages(conversationId: string, userId: string, searchTerm: string, limit: number = 20): Promise<MappedMessage[]> {
    await this.assertConversationAccess(conversationId, userId);

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('chat_messages')
      .select(
        'id, conversation_id, sender_id, recipient_id, group_id, encrypted_content, iv, message_type, is_edited, is_deleted, read_by, delivered_to, reactions, metadata, created_at, updated_at'
      )
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .eq('message_type', 'text')
      .order('created_at', { ascending: false })
      .limit(100);

    const rows = (data || []) as unknown as ChatMessageRow[];
    const q = searchTerm.toLowerCase();

    const matches = [];
    for (const row of rows) {
      const plain = this.decryptMessageContent(row.encrypted_content, row.iv);
      if (plain.toLowerCase().includes(q)) {
        matches.push({ ...row, __plain: plain } as any);
      }
      if (matches.length >= limit) break;
    }

    const userIds = uniq(matches.flatMap((r: any) => [r.sender_id, r.recipient_id].filter(Boolean)));
    const basics = await getUsersBasics(userIds);

    return matches
      .reverse()
      .map((row: any) => ({
        _id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        recipientId: row.recipient_id || undefined,
        groupId: row.group_id || undefined,
        content: row.__plain,
        messageType: 'text',
        metadata: row.metadata || undefined,
        sender: basics.get(row.sender_id)
          ? {
              _id: row.sender_id,
              email: basics.get(row.sender_id)?.email,
              username: basics.get(row.sender_id)?.username,
              avatar: basics.get(row.sender_id)?.avatar
            }
          : undefined,
        recipient: row.recipient_id && basics.get(row.recipient_id)
          ? {
              _id: row.recipient_id,
              email: basics.get(row.recipient_id)?.email,
              username: basics.get(row.recipient_id)?.username,
              avatar: basics.get(row.recipient_id)?.avatar
            }
          : undefined,
        readBy: Array.isArray(row.read_by) ? row.read_by : [],
        deliveredTo: Array.isArray(row.delivered_to) ? row.delivered_to : [],
        isEdited: Boolean(row.is_edited),
        isDeleted: Boolean(row.is_deleted),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        timestamp: row.created_at
      }))
      .reverse();
  }

  decryptMessageContent(encryptedContent: string, iv: string): string {
    return encryptionService.decryptMessage(encryptedContent, iv);
  }

  async addReaction(_messageId: string, _userId: string, _emoji: string): Promise<never> {
    throw new Error('Reactions are not implemented in the Postgres migration yet');
  }

  async removeReaction(_messageId: string, _userId: string, _emoji: string): Promise<never> {
    throw new Error('Reactions are not implemented in the Postgres migration yet');
  }

  async forwardMessage(_messageId: string, _userId: string, _targetConversationId: string): Promise<never> {
    throw new Error('Forwarding is not implemented in the Postgres migration yet');
  }

  async getGroupMemberIds(groupId: string): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('study_group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (error) {
      return [];
    }

    return (data || []).map((row: any) => row.user_id).filter(Boolean);
  }

  private generateConversationId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  private async assertConversationAccess(conversationId: string, userId: string): Promise<void> {
    if (conversationId.startsWith('group_')) {
      const groupId = conversationId.replace(/^group_/, '');
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('study_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!data) {
        throw new Error('Unauthorized access to group');
      }
      return;
    }

    const parts = conversationId.split('_').map(p => p.trim()).filter(Boolean);
    if (parts.length === 2 && parts.includes(userId)) {
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('conversations')
      .select('conversation_id, participants')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    const participants = (data as any)?.participants as string[] | undefined;
    if (!participants || !participants.includes(userId)) {
      throw new Error('Unauthorized access to conversation');
    }
  }

  private async updateConversationMetadata(
    conversationId: string,
    participantIds: string[],
    senderId: string,
    lastMessageContent: string,
    isGroupChat: boolean,
    groupId?: string
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('conversations')
      .select('conversation_id, participants, unread_count')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    const participants = uniq(participantIds);
    const unread = existing && (existing as any).unread_count && typeof (existing as any).unread_count === 'object'
      ? { ...(existing as any).unread_count }
      : {};

    participants.forEach(pid => {
      if (pid === senderId) return;
      unread[pid] = Number(unread[pid] || 0) + 1;
    });

    const lastMessage = {
      senderId,
      preview: safePreview(lastMessageContent),
      timestamp: now
    };

    if (!existing) {
      await supabase.from('conversations').insert({
        conversation_id: conversationId,
        participants,
        is_group_chat: isGroupChat,
        group_id: isGroupChat ? groupId || null : null,
        last_message: lastMessage,
        unread_count: unread,
        created_at: now
      });
      return;
    }

    await supabase
      .from('conversations')
      .update({
        participants,
        is_group_chat: isGroupChat,
        group_id: isGroupChat ? groupId || null : null,
        last_message: lastMessage,
        unread_count: unread
      })
      .eq('conversation_id', conversationId);
  }

  private async decrementUnreadCount(conversationId: string, userId: string, delta: number): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('conversations')
      .select('conversation_id, unread_count')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!data) return;

    const unread = (data as any).unread_count && typeof (data as any).unread_count === 'object' ? { ...(data as any).unread_count } : {};
    const current = Number(unread[userId] || 0);
    unread[userId] = Math.max(0, current - Math.max(1, delta));
    await supabase.from('conversations').update({ unread_count: unread }).eq('conversation_id', conversationId);
  }
}

export const chatService = new ChatService();
