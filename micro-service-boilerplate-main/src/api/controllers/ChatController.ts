import { Logger } from '@lib/logger';
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
  QueryParam,
  Req,
  UploadedFile
} from 'routing-controllers';
import type { Request } from 'express';

import { emitToGroup, emitToUser } from '../../loaders/SocketIOLoader';
import { chatService } from '../services/ChatService';
import { FileMetadata, fileStorageService } from '../services/FileStorageService';

const log = new Logger(__filename);

type UploadBody = {
  conversationId?: string;
  messageType?: string;
  duration?: number | string;
  width?: number | string;
  height?: number | string;
  waveformData?: string;
  caption?: string;
};

const parseNumber = (value?: number | string) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(num) ? undefined : num;
};

const parseWaveform = (value?: string) => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(entry => Number(entry)).filter(entry => !Number.isNaN(entry));
    }
  } catch (error) {
    log.warn('Invalid waveformData JSON, skipping', error as any);
  }
  return undefined;
};

const resolveDirectParticipants = (conversationId: string, currentUserId: string) => {
  const trimmed = (conversationId || '').trim();
  if (!trimmed) {
    throw new BadRequestError('conversationId is required');
  }

  // Some legacy callers pass just the recipient id. Prefer the canonical `<a>_<b>` format.
  if (!trimmed.includes('_')) {
    const recipientId = trimmed;
    if (recipientId === currentUserId) {
      throw new BadRequestError('Cannot send media to yourself');
    }
    const ids = [currentUserId, recipientId].sort();
    return { recipientId, canonicalConversationId: `${ids[0]}_${ids[1]}` };
  }

  const parts = trimmed.split('_').map(p => p.trim()).filter(Boolean);
  if (parts.length !== 2) {
    throw new BadRequestError('Invalid conversation identifier');
  }

  if (!parts.includes(currentUserId)) {
    throw new BadRequestError('User is not part of this conversation');
  }

  const recipientId = parts[0] === currentUserId ? parts[1] : parts[0];
  const ids = [currentUserId, recipientId].sort();
  return { recipientId, canonicalConversationId: `${ids[0]}_${ids[1]}` };
};

@JsonController('/chat')
export class ChatController {
  /**
   * Get user's conversations
   */
  @Get('/conversations')
  async getConversations(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const conversations = await chatService.getUserConversations(currentUser.id);
      return { success: true, data: conversations };
    } catch (error: any) {
      log.error('Error getting conversations:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get conversation messages
   */
  @Get('/messages/:conversationId')
  async getMessages(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('conversationId') conversationId: string,
    @QueryParam('limit') limit?: number,
    @QueryParam('before') before?: string
  ) {
    try {
      const messages = await chatService.getConversationMessages(conversationId, currentUser.id, limit || 50, before);
      return { success: true, data: messages };
    } catch (error: any) {
      log.error('Error getting messages:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Mark message as read
   */
  @Post('/messages/:messageId/read')
  async markAsRead(@CurrentUser({ required: true }) currentUser: any, @Param('messageId') messageId: string) {
    try {
      await chatService.markMessageAsRead(messageId, currentUser.id);
      return { success: true, message: 'Message marked as read' };
    } catch (error: any) {
      log.error('Error marking message as read:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Mark all messages in conversation as read
   */
  @Post('/conversations/:conversationId/read')
  async markConversationAsRead(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('conversationId') conversationId: string
  ) {
    try {
      await chatService.markConversationAsRead(conversationId, currentUser.id);
      return { success: true, message: 'Conversation marked as read' };
    } catch (error: any) {
      log.error('Error marking conversation as read:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Delete message (soft delete)
   */
  @Delete('/messages/:messageId')
  async deleteMessage(@CurrentUser({ required: true }) currentUser: any, @Param('messageId') messageId: string) {
    try {
      await chatService.deleteMessage(messageId, currentUser.id);
      return { success: true, message: 'Message deleted' };
    } catch (error: any) {
      log.error('Error deleting message:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Edit message
   */
  @Put('/messages/:messageId')
  async editMessage(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('messageId') messageId: string,
    @Body() body: { content: string }
  ) {
    try {
      const updated = await chatService.editMessage(messageId, currentUser.id, body.content);
      const decrypted = chatService.decryptMessageContent(updated.encrypted_content, updated.iv);

      return {
        success: true,
        message: 'Message updated',
        data: {
          _id: updated.id,
          conversationId: updated.conversation_id,
          senderId: updated.sender_id,
          recipientId: updated.recipient_id || undefined,
          groupId: updated.group_id || undefined,
          content: decrypted,
          messageType: updated.message_type,
          metadata: updated.metadata || undefined,
          readBy: Array.isArray(updated.read_by) ? updated.read_by : [],
          deliveredTo: Array.isArray(updated.delivered_to) ? updated.delivered_to : [],
          isEdited: Boolean(updated.is_edited),
          isDeleted: Boolean(updated.is_deleted),
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
          timestamp: updated.created_at
        }
      };
    } catch (error: any) {
      log.error('Error editing message:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get total unread message count
   */
  @Get('/unread')
  async getUnreadCount(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const count = await chatService.getUnreadCount(currentUser.id);
      return { success: true, data: { unreadCount: count } };
    } catch (error: any) {
      log.error('Error getting unread count:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Search messages in a conversation
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
      return { success: true, data: results };
    } catch (error: any) {
      log.error('Error searching messages:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Upload media file (image, video, audio, gif)
   * POST /api/chat/upload
   */
  @Post('/upload')
  async uploadFile(
    @CurrentUser({ required: true }) currentUser: any,
    @UploadedFile('file', { required: true }) file: Express.Multer.File,
    @Body() body: UploadBody,
    @Req() req?: Request
  ) {
    try {
      if (!body?.conversationId) {
        throw new BadRequestError('conversationId is required');
      }

      const rawMessageType = (body.messageType || 'image').toString().toLowerCase();
      const supportedTypes = ['image', 'video', 'audio', 'file', 'gif'] as const;
      const messageType = supportedTypes.includes(rawMessageType as any)
        ? (rawMessageType as (typeof supportedTypes)[number])
        : 'image';

      const conversationId = body.conversationId.trim();
      const isGroupConversation = conversationId.startsWith('group_');

      let recipientId: string | undefined;
      let groupId: string | undefined;
      let memberIds: string[] = [];
      let canonicalConversationId = conversationId;

      if (isGroupConversation) {
        groupId = conversationId.replace(/^group_/, '');
        memberIds = await chatService.getGroupMemberIds(groupId);
        if (!memberIds.includes(currentUser.id)) {
          throw new BadRequestError('User is not a member of this group');
        }
        canonicalConversationId = `group_${groupId}`;
      } else {
        const resolved = resolveDirectParticipants(conversationId, currentUser.id);
        recipientId = resolved.recipientId;
        canonicalConversationId = resolved.canonicalConversationId;
      }

      const storageMetadata: FileMetadata = {
        userId: currentUser.id,
        conversationId: canonicalConversationId,
        messageType,
        duration: parseNumber(body.duration),
        width: parseNumber(body.width),
        height: parseNumber(body.height),
        waveformData: parseWaveform(body.waveformData)
      };

      const uploadedFile = await fileStorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        storageMetadata
      );

      const messageMetadata: any = {
        fileName: uploadedFile.fileName,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
        bucket: uploadedFile.bucket,
        path: uploadedFile.objectPath,
        fileUrl: uploadedFile.url,
        duration: storageMetadata.duration,
        width: storageMetadata.width,
        height: storageMetadata.height,
        waveformData: storageMetadata.waveformData
      };

      const caption = (body.caption || '').trim();
      const previewContentMap: Record<typeof messageType, string> = {
        image: caption ? `📷 ${caption}` : '📷 Photo',
        video: caption ? `🎬 ${caption}` : '🎬 Video',
        audio: caption ? `🎙️ ${caption}` : '🎙️ Voice note',
        file: caption ? `📎 ${caption}` : '📎 File',
        gif: caption ? `🎞️ ${caption}` : '🎞️ GIF'
      };

      const previewContent = previewContentMap[messageType];

      const savedMessage = isGroupConversation
        ? await chatService.sendGroupMessage(currentUser.id, groupId!, previewContent, memberIds, messageType, messageMetadata)
        : await chatService.sendDirectMessage(currentUser.id, recipientId!, previewContent, messageType, messageMetadata);

      const decrypted = chatService.decryptMessageContent(savedMessage.encrypted_content, savedMessage.iv);

      const responseMessage = {
        _id: savedMessage.id,
        conversationId: savedMessage.conversation_id,
        senderId: savedMessage.sender_id,
        recipientId: savedMessage.recipient_id || undefined,
        groupId: savedMessage.group_id || undefined,
        content: decrypted,
        messageType: savedMessage.message_type,
        metadata: savedMessage.metadata || undefined,
        mediaUrl: savedMessage.metadata?.fileUrl || undefined,
        thumbnailUrl: savedMessage.metadata?.thumbnailUrl || undefined,
        readBy: Array.isArray(savedMessage.read_by) ? savedMessage.read_by : [],
        deliveredTo: Array.isArray(savedMessage.delivered_to) ? savedMessage.delivered_to : [],
        isEdited: Boolean(savedMessage.is_edited),
        isDeleted: Boolean(savedMessage.is_deleted),
        createdAt: savedMessage.created_at,
        updatedAt: savedMessage.updated_at,
        timestamp: savedMessage.created_at,
        status: 'delivered'
      };

      // Mirror socket behavior for upload-created messages.
      emitToUser(currentUser.id, 'message:sent', responseMessage);
      if (isGroupConversation) {
        emitToGroup(groupId!, 'group:message:receive', responseMessage);
      } else {
        emitToUser(recipientId!, 'message:receive', responseMessage);
      }

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileId: uploadedFile.fileId,
          mediaUrl: uploadedFile.url,
          thumbnailUrl: uploadedFile.thumbnailUrl,
          fileName: uploadedFile.fileName,
          fileSize: uploadedFile.fileSize,
          mimeType: uploadedFile.mimeType,
          metadata: messageMetadata,
          message: responseMessage
        }
      };
    } catch (error: any) {
      log.error('Error uploading file:', {
        message: error?.message,
        stack: error?.stack,
        error
      });
      throw new BadRequestError(error.message || 'Failed to upload file');
    }
  }
}

