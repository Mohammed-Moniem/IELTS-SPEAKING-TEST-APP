import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import { ChatMessage, Conversation, IChatMessage } from '../models/ChatMessageModel';
import { StudyGroup } from '../models/StudyGroupModel';
import { encryptionService } from './EncryptionService';
import { friendService } from './FriendService';

const log = new Logger(__filename);

export class ChatService {
  /**
   * Send a direct message (1-on-1)
   */
  async sendDirectMessage(
    senderId: string,
    recipientId: string,
    content: string,
    messageType: 'text' | 'image' | 'audio' | 'video' | 'file' | 'gif' = 'text',
    metadata?: any
  ): Promise<IChatMessage> {
    // Check if users are friends
    const areFriends = await friendService.areFriends(senderId, recipientId);
    if (!areFriends) {
      throw new Error('Can only send messages to friends');
    }

    // Encrypt message
    const { encryptedContent, iv } = encryptionService.encryptMessage(content);

    // Generate conversation ID
    const conversationId = this.generateConversationId(senderId, recipientId);

    // Create message
    const message = new ChatMessage({
      conversationId,
      senderId: new Types.ObjectId(senderId),
      recipientId: new Types.ObjectId(recipientId),
      encryptedContent,
      iv,
      messageType,
      metadata,
      deliveredTo: [new Types.ObjectId(recipientId)]
    });

    await message.save();

    // Update conversation metadata
    await this.updateConversationMetadata(conversationId, [senderId, recipientId], senderId, content, false);

    log.info(`Message sent from ${senderId} to ${recipientId}`);
    return message;
  }

  /**
   * Send a group message
   */
  async sendGroupMessage(
    senderId: string,
    groupId: string,
    content: string,
    memberIds: string[],
    messageType: 'text' | 'image' | 'audio' | 'video' | 'file' | 'gif' = 'text',
    metadata?: any
  ): Promise<IChatMessage> {
    // Encrypt message
    const { encryptedContent, iv } = encryptionService.encryptMessage(content);

    const conversationId = `group_${groupId}`;

    // Create message
    const message = new ChatMessage({
      conversationId,
      senderId: new Types.ObjectId(senderId),
      groupId: new Types.ObjectId(groupId),
      encryptedContent,
      iv,
      messageType,
      metadata,
      deliveredTo: memberIds.filter(id => id !== senderId).map(id => new Types.ObjectId(id))
    });

    await message.save();

    // Update conversation metadata
    await this.updateConversationMetadata(conversationId, memberIds, senderId, content, true, groupId);

    log.info(`Group message sent by ${senderId} in group ${groupId}`);
    return message;
  }

  /**
   * Get conversation messages with pagination
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    limit: number = 50,
    before?: string
  ): Promise<IChatMessage[]> {
    const query: any = {
      conversationId,
      isDeleted: false
    };

    const userObjectId = new Types.ObjectId(userId);

    // Check authorization based on conversation type
    if (conversationId.startsWith('group_')) {
      // Group chat - check group membership
      const groupId = conversationId.replace('group_', '');
      const group = await StudyGroup.findById(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      const isMember = group.memberIds.some((memberId: Types.ObjectId) => {
        return memberId.equals(userObjectId);
      });

      if (!isMember) {
        throw new Error('Unauthorized access to group');
      }

      log.info(`User ${userId} authorized to access group ${groupId} messages`);
    } else {
      // Direct message - check conversation participants
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const isParticipant = conversation.participants.some(participant => {
        if (!participant) {
          return false;
        }

        const candidate: any = participant;

        if (typeof candidate.equals === 'function') {
          return candidate.equals(userObjectId);
        }

        if (candidate._id && typeof candidate._id.equals === 'function') {
          return candidate._id.equals(userObjectId);
        }

        return candidate.toString() === userId;
      });

      if (!isParticipant) {
        throw new Error('Unauthorized access to conversation');
      }
    }

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Support passing a message ID in the "before" parameter (legacy clients)
    if (!query.createdAt && before) {
      try {
        const pivotMessage = await ChatMessage.findById(before);
        if (pivotMessage) {
          query.createdAt = { $lt: pivotMessage.createdAt };
        }
      } catch (error) {
        log.warn('Invalid before parameter provided, unable to resolve message pivot', {
          conversationId,
          before
        });
      }
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'firstName lastName email username avatar')
      .populate('recipientId', 'firstName lastName email username avatar')
      .populate('groupId', 'name avatar');

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Get user's conversations list
   */
  async getUserConversations(userId: string): Promise<any[]> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      const conversations = await Conversation.find({
        participants: userObjectId
      })
        .sort({ 'lastMessage.timestamp': -1 })
        .populate('participants', 'firstName lastName email username avatar')
        .populate('groupId', 'name avatar');

      return conversations.map(conversation => {
        const unreadCount =
          typeof conversation.unreadCount?.get === 'function'
            ? (conversation.unreadCount.get(userId) ?? 0)
            : // Fallback in case Mongoose has already converted Map -> Object
              ((conversation.unreadCount as unknown as Record<string, number> | undefined)?.[userId] ?? 0);

        const participants = (conversation.participants || []).map((participant: any) => {
          if (!participant) {
            return participant;
          }

          if (participant._id && participant.firstName !== undefined) {
            return {
              _id: participant._id.toString(),
              email: participant.email,
              username: participant.username,
              firstName: participant.firstName,
              lastName: participant.lastName,
              avatar: participant.avatar
            };
          }

          // Non-populated ObjectId
          const participantId = participant.toString();
          return {
            _id: participantId,
            email: undefined,
            username: undefined,
            firstName: undefined,
            lastName: undefined,
            avatar: undefined
          };
        });

        const groupData = (() => {
          if (!conversation.isGroupChat || !conversation.groupId) {
            return { groupId: undefined, groupName: undefined, groupAvatar: undefined };
          }

          const group: any = conversation.groupId;
          return {
            groupId: group._id ? group._id.toString() : group.toString(),
            groupName: group.name,
            groupAvatar: group.avatar
          };
        })();

        const lastMessage = conversation.lastMessage
          ? {
              preview: conversation.lastMessage.preview,
              timestamp: conversation.lastMessage.timestamp,
              senderId: conversation.lastMessage.senderId ? conversation.lastMessage.senderId.toString() : undefined
            }
          : undefined;

        return {
          _id: conversation._id.toString(),
          conversationId: conversation.conversationId,
          participants,
          isGroupChat: conversation.isGroupChat,
          lastMessage,
          unreadCount,
          groupId: groupData.groupId,
          groupName: groupData.groupName,
          groupAvatar: groupData.groupAvatar,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        };
      });
    } catch (error) {
      log.error('Error fetching user conversations:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Add user to readBy array if not already present
    const userObjectId = new Types.ObjectId(userId);
    if (!message.readBy.some(id => id.equals(userObjectId))) {
      message.readBy.push(userObjectId);
      await message.save();
    }

    // Update unread count in conversation
    await this.updateUnreadCount(message.conversationId, userId, -1);
  }

  /**
   * Mark all messages in conversation as read
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    const messages = await ChatMessage.find({
      conversationId,
      isDeleted: false,
      senderId: { $ne: new Types.ObjectId(userId) },
      readBy: { $ne: new Types.ObjectId(userId) }
    });

    const userObjectId = new Types.ObjectId(userId);

    for (const message of messages) {
      message.readBy.push(userObjectId);
      await message.save();
    }

    // Reset unread count
    const conversation = await Conversation.findOne({ conversationId });
    if (conversation) {
      conversation.unreadCount.set(userId, 0);
      await conversation.save();
    }
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete their messages
    if (message.senderId.toString() !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    message.isDeleted = true;
    await message.save();
  }

  /**
   * Edit message
   */
  async editMessage(messageId: string, userId: string, newContent: string): Promise<IChatMessage> {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can edit their messages
    if (message.senderId.toString() !== userId) {
      throw new Error('Unauthorized to edit this message');
    }

    // Only text messages can be edited
    if (message.messageType !== 'text') {
      throw new Error('Only text messages can be edited');
    }

    // Encrypt new content
    const { encryptedContent, iv } = encryptionService.encryptMessage(newContent);

    message.encryptedContent = encryptedContent;
    message.iv = iv;
    message.isEdited = true;

    return await message.save();
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const conversations = await Conversation.find({
        participants: new Types.ObjectId(userId)
      });

      let totalUnread = 0;
      for (const conv of conversations) {
        const count = conv.unreadCount?.get(userId) || 0;
        totalUnread += count;
      }

      log.info(`Unread count for user ${userId}: ${totalUnread}`);
      return totalUnread;
    } catch (error) {
      log.error(`Error getting unread count for user ${userId}:`, error);
      // Return 0 instead of throwing to avoid breaking the UI
      return 0;
    }
  }

  /**
   * Search messages in conversation
   */
  async searchMessages(conversationId: string, userId: string, searchTerm: string, limit: number = 20): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);

    // Check authorization based on conversation type
    if (conversationId.startsWith('group_')) {
      // Group chat - check group membership
      const groupId = conversationId.replace('group_', '');
      const group = await StudyGroup.findById(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      const isMember = group.memberIds.some((memberId: Types.ObjectId) => {
        return memberId.equals(userObjectId);
      });

      if (!isMember) {
        throw new Error('Unauthorized access to group');
      }
    } else {
      // Direct message - check conversation participants
      const conversation = await Conversation.findOne({ conversationId });
      if (
        !conversation ||
        !conversation.participants.some((participant: any) => participant?.toString?.() === userObjectId.toString())
      ) {
        throw new Error('Unauthorized access to conversation');
      }
    }

    // Get all messages (we need to decrypt them to search)
    const messages = await ChatMessage.find({
      conversationId,
      isDeleted: false,
      messageType: 'text'
    })
      .sort({ createdAt: -1 })
      .limit(100) // Limit to recent messages for performance
      .populate('senderId', 'name email');

    // Decrypt and search
    const results: any[] = [];
    const searchLower = searchTerm.toLowerCase();

    for (const message of messages) {
      try {
        const decrypted = encryptionService.decryptMessage(message.encryptedContent, message.iv);

        if (decrypted.toLowerCase().includes(searchLower)) {
          results.push({
            ...message.toObject(),
            decryptedContent: decrypted
          });
        }

        if (results.length >= limit) break;
      } catch (error) {
        log.error('Error decrypting message for search:', error);
      }
    }

    return results;
  }

  /**
   * Decrypt message content (helper for API responses)
   */
  decryptMessageContent(encryptedContent: string, iv: string): string {
    return encryptionService.decryptMessage(encryptedContent, iv);
  }

  /**
   * Generate conversation ID for 1-on-1 chats
   */
  private generateConversationId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Update conversation metadata
   */
  private async updateConversationMetadata(
    conversationId: string,
    participantIds: string[],
    senderId: string,
    lastMessageContent: string,
    isGroupChat: boolean,
    groupId?: string
  ): Promise<void> {
    const safeContent = lastMessageContent ?? '';
    const preview = safeContent.length > 50 ? `${safeContent.substring(0, 50)}...` : safeContent;

    let conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        conversationId,
        participants: participantIds.map(id => new Types.ObjectId(id)),
        isGroupChat,
        groupId: groupId ? new Types.ObjectId(groupId) : undefined,
        lastMessage: {
          senderId: new Types.ObjectId(senderId),
          preview,
          timestamp: new Date()
        },
        unreadCount: new Map()
      });
    } else {
      // Update existing conversation
      conversation.lastMessage = {
        senderId: new Types.ObjectId(senderId),
        preview,
        timestamp: new Date()
      };
    }

    // Increment unread count for all participants except sender
    for (const participantId of participantIds) {
      if (participantId !== senderId) {
        const currentCount = conversation.unreadCount.get(participantId) || 0;
        conversation.unreadCount.set(participantId, currentCount + 1);
      }
    }

    await conversation.save();
  }

  /**
   * Update unread count
   */
  private async updateUnreadCount(conversationId: string, userId: string, delta: number): Promise<void> {
    const conversation = await Conversation.findOne({ conversationId });

    if (conversation) {
      const currentCount = conversation.unreadCount.get(userId) || 0;
      const newCount = Math.max(0, currentCount + delta);
      conversation.unreadCount.set(userId, newCount);
      await conversation.save();
    }
  }

  /**
   * Add reaction to a message
   */
  async addReaction(messageId: string, userId: string, emoji: string): Promise<IChatMessage> {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user is a participant
    const isParticipant =
      message.senderId.toString() === userId ||
      message.recipientId?.toString() === userId ||
      (message.groupId && (await this.isGroupMember(message.groupId.toString(), userId)));

    if (!isParticipant) {
      throw new Error('Not authorized to react to this message');
    }

    // Get current reactions for this emoji
    const userIdObj = new Types.ObjectId(userId);
    const currentReactions = message.reactions.get(emoji) || [];

    // Check if user already reacted with this emoji
    const alreadyReacted = currentReactions.some(id => id.toString() === userId);

    if (!alreadyReacted) {
      currentReactions.push(userIdObj);
      message.reactions.set(emoji, currentReactions);
      await message.save();
    }

    return message;
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(messageId: string, userId: string, emoji: string): Promise<IChatMessage> {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Get current reactions for this emoji
    const currentReactions = message.reactions.get(emoji) || [];

    // Filter out this user's reaction
    const updatedReactions = currentReactions.filter(id => id.toString() !== userId);

    if (updatedReactions.length === 0) {
      message.reactions.delete(emoji);
    } else {
      message.reactions.set(emoji, updatedReactions);
    }

    await message.save();
    return message;
  }

  /**
   * Forward a message to another conversation
   */
  async forwardMessage(messageId: string, userId: string, targetConversationId: string): Promise<IChatMessage> {
    // Get original message
    const originalMessage = await ChatMessage.findById(messageId);

    if (!originalMessage) {
      throw new Error('Message not found');
    }

    // Verify user can access original message
    const canAccess =
      originalMessage.senderId.toString() === userId ||
      originalMessage.recipientId?.toString() === userId ||
      (originalMessage.groupId && (await this.isGroupMember(originalMessage.groupId.toString(), userId)));

    if (!canAccess) {
      throw new Error('Not authorized to forward this message');
    }

    // Get target conversation
    const targetConversation = await Conversation.findOne({ conversationId: targetConversationId });

    if (!targetConversation) {
      throw new Error('Target conversation not found');
    }

    // Verify user is participant in target conversation
    const isParticipant = targetConversation.participants.some(p => p.toString() === userId);

    if (!isParticipant) {
      throw new Error('Not authorized to send to this conversation');
    }

    // Decrypt original content
    const decryptedContent = this.decryptMessageContent(originalMessage.encryptedContent, originalMessage.iv);

    // Re-encrypt for forwarded message
    const { encryptedContent, iv } = encryptionService.encryptMessage(decryptedContent);

    // Create forwarded message
    const forwardedMessage = new ChatMessage({
      conversationId: targetConversationId,
      senderId: new Types.ObjectId(userId),
      recipientId: targetConversation.isGroupChat
        ? undefined
        : targetConversation.participants.find(p => p.toString() !== userId),
      groupId: targetConversation.isGroupChat ? targetConversation.groupId : undefined,
      encryptedContent,
      iv,
      messageType: originalMessage.messageType,
      metadata: {
        ...originalMessage.metadata,
        forwardedFromUserId: originalMessage.senderId,
        originalMessageId: originalMessage._id
      },
      deliveredTo: []
    });

    await forwardedMessage.save();

    // Update target conversation metadata
    await this.updateConversationMetadata(
      targetConversationId,
      targetConversation.participants.map(p => p.toString()),
      userId,
      decryptedContent.substring(0, 100),
      targetConversation.isGroupChat
    );

    log.info(`Message ${messageId} forwarded by ${userId} to ${targetConversationId}`);
    return forwardedMessage;
  }

  /**
   * Check if user is a member of a group
   */
  private async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    // This would check against a Group model if you have one
    // For now, check if user is in any conversation with this groupId
    const conversation = await Conversation.findOne({
      groupId: new Types.ObjectId(groupId),
      participants: new Types.ObjectId(userId)
    });

    return !!conversation;
  }
}

export const chatService = new ChatService();
