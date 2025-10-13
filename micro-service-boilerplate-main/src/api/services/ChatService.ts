import { Types } from 'mongoose';
import { Logger } from '../../lib/logger';
import { ChatMessage, Conversation, IChatMessage, IConversation } from '../models/ChatMessageModel';
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
    messageType: 'text' | 'image' | 'audio' | 'file' = 'text',
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
    messageType: 'text' | 'image' | 'audio' | 'file' = 'text',
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
    before?: Date
  ): Promise<IChatMessage[]> {
    const query: any = {
      conversationId,
      isDeleted: false
    };

    // Only return messages for conversations user is part of
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.participants.includes(new Types.ObjectId(userId))) {
      throw new Error('Unauthorized access to conversation');
    }

    if (before) {
      query.createdAt = { $lt: before };
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'name email');

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Get user's conversations list
   */
  async getUserConversations(userId: string): Promise<IConversation[]> {
    const conversations = await Conversation.find({
      participants: new Types.ObjectId(userId)
    })
      .sort({ 'lastMessage.timestamp': -1 })
      .populate('participants', 'name email')
      .populate('groupId', 'name avatar');

    return conversations;
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
    // Verify user is part of conversation
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.participants.includes(new Types.ObjectId(userId))) {
      throw new Error('Unauthorized access to conversation');
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
    const preview = encryptionService.createPreview(
      lastMessageContent,
      '' // Preview doesn't need IV, we just truncate
    );

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
}

export const chatService = new ChatService();
