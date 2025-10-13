import {
  BadRequestError,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  Param,
  Post,
  Put,
  QueryParam
} from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { chatService } from '../services/ChatService';

const log = new Logger(__filename);

@JsonController('/chat')
export class ChatController {
  /**
   * Get user's conversations
   * GET /api/chat/conversations
   */
  @Get('/conversations')
  async getConversations(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const conversations = await chatService.getUserConversations(currentUser.id);

      return {
        success: true,
        data: conversations
      };
    } catch (error: any) {
      log.error('Error getting conversations:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get conversation messages
   * GET /api/chat/messages/:conversationId
   */
  @Get('/messages/:conversationId')
  async getMessages(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('conversationId') conversationId: string,
    @QueryParam('limit') limit?: number,
    @QueryParam('before') before?: string
  ) {
    try {
      const messages = await chatService.getConversationMessages(
        conversationId,
        currentUser.id,
        limit || 50,
        before ? new Date(before) : undefined
      );

      // Decrypt messages for response
      const decryptedMessages = messages.map(msg => ({
        ...msg.toObject(),
        content: chatService.decryptMessageContent(msg.encryptedContent, msg.iv),
        encryptedContent: undefined,
        iv: undefined
      }));

      return {
        success: true,
        data: decryptedMessages
      };
    } catch (error: any) {
      log.error('Error getting messages:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Mark message as read
   * POST /api/chat/messages/:messageId/read
   */
  @Post('/messages/:messageId/read')
  async markAsRead(@CurrentUser({ required: true }) currentUser: any, @Param('messageId') messageId: string) {
    try {
      await chatService.markMessageAsRead(messageId, currentUser.id);

      return {
        success: true,
        message: 'Message marked as read'
      };
    } catch (error: any) {
      log.error('Error marking message as read:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Mark all messages in conversation as read
   * POST /api/chat/conversations/:conversationId/read
   */
  @Post('/conversations/:conversationId/read')
  async markConversationAsRead(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('conversationId') conversationId: string
  ) {
    try {
      await chatService.markConversationAsRead(conversationId, currentUser.id);

      return {
        success: true,
        message: 'Conversation marked as read'
      };
    } catch (error: any) {
      log.error('Error marking conversation as read:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Delete message
   * DELETE /api/chat/messages/:messageId
   */
  @Delete('/messages/:messageId')
  async deleteMessage(@CurrentUser({ required: true }) currentUser: any, @Param('messageId') messageId: string) {
    try {
      await chatService.deleteMessage(messageId, currentUser.id);

      return {
        success: true,
        message: 'Message deleted'
      };
    } catch (error: any) {
      log.error('Error deleting message:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Edit message
   * PUT /api/chat/messages/:messageId
   */
  @Put('/messages/:messageId')
  async editMessage(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('messageId') messageId: string,
    @Body() body: { content: string }
  ) {
    try {
      const updatedMessage = await chatService.editMessage(messageId, currentUser.id, body.content);

      return {
        success: true,
        message: 'Message updated',
        data: {
          ...updatedMessage.toObject(),
          content: chatService.decryptMessageContent(updatedMessage.encryptedContent, updatedMessage.iv),
          encryptedContent: undefined,
          iv: undefined
        }
      };
    } catch (error: any) {
      log.error('Error editing message:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get unread count
   * GET /api/chat/unread
   */
  @Get('/unread')
  async getUnreadCount(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const count = await chatService.getUnreadCount(currentUser.id);

      return {
        success: true,
        data: { unreadCount: count }
      };
    } catch (error: any) {
      log.error('Error getting unread count:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Search messages
   * GET /api/chat/search/:conversationId
   */
  @Get('/search/:conversationId')
  async searchMessages(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('conversationId') conversationId: string,
    @QueryParam('q') query: string,
    @QueryParam('limit') limit?: number
  ) {
    try {
      if (!query || query.length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const results = await chatService.searchMessages(conversationId, currentUser.id, query, limit || 20);

      return {
        success: true,
        data: results
      };
    } catch (error: any) {
      log.error('Error searching messages:', error);
      throw new BadRequestError(error.message);
    }
  }
}
