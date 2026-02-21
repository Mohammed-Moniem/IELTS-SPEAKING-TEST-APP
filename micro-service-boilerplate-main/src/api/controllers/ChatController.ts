import { Request, Response } from 'express';
import { Types } from '@lib/db/mongooseCompat';
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
  Res,
  UploadedFile
} from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { emitToGroup, emitToUser } from '../../loaders/SocketIOLoader';
import { Conversation } from '../models/ChatMessageModel';
import { chatService } from '../services/ChatService';
import { FileMetadata, fileStorageService } from '../services/FileStorageService';

const log = new Logger(__filename);

const resolveId = (value: any): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }

  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }

  if (value._id) {
    return resolveId(value._id);
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return undefined;
};

const mapParticipant = (value: any) => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const participantId = resolveId(value);
  const source = value._doc ?? value;

  return {
    _id: participantId,
    firstName: source.firstName,
    lastName: source.lastName,
    email: source.email,
    username: source.username,
    avatar: source.avatar
  };
};

const getRequestBaseUrl = (req: Request): string | undefined => {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!proto || !host) {
    return undefined;
  }

  return `${proto}://${host}`;
};

const makeAbsoluteUrl = (baseUrl: string | undefined, value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!baseUrl) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${baseUrl}${normalized}`;
};

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
    @QueryParam('before') before?: string,
    @Req() req?: Request
  ) {
    try {
      const messages = await chatService.getConversationMessages(conversationId, currentUser.id, limit || 50, before);

      const baseUrl = req ? getRequestBaseUrl(req) : undefined;
      const toAbsolute = (url?: string) => makeAbsoluteUrl(baseUrl, url);

      // Decrypt messages for response
      const decryptedMessages = messages.map(msg => {
        const msgObj = msg.toObject({ virtuals: false });

        const senderId = resolveId(msgObj.senderId);
        const recipientId = resolveId(msgObj.recipientId);
        const groupId = resolveId(msgObj.groupId);

        const metadata = msgObj.metadata ?? {};
        const mediaUrl = toAbsolute(metadata.fileUrl);
        const thumbnailUrl = toAbsolute(metadata.thumbnailUrl);

        return {
          ...msgObj,
          _id: msg._id.toString(),
          senderId,
          recipientId,
          groupId,
          sender: mapParticipant(msgObj.senderId),
          recipient: mapParticipant(msgObj.recipientId),
          mediaUrl,
          thumbnailUrl,
          readBy: msg.readBy.map((id: any) => id.toString()),
          deliveredTo: msg.deliveredTo.map((id: any) => id.toString()),
          content: chatService.decryptMessageContent(msg.encryptedContent, msg.iv),
          encryptedContent: undefined,
          iv: undefined
        };
      });

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

  /**
   * Upload media file (image, video, audio, gif)
   * POST /api/chat/upload
   */
  @Post('/upload')
  async uploadFile(
    @CurrentUser({ required: true }) currentUser: any,
    @UploadedFile('file', { required: true }) file: Express.Multer.File,
    @Body()
    body: {
      conversationId?: string;
      messageType?: string;
      duration?: number | string;
      width?: number | string;
      height?: number | string;
      waveformData?: string;
      caption?: string;
    },
    @Req() req?: Request
  ) {
    try {
      if (!body?.conversationId) {
        throw new BadRequestError('conversationId is required');
      }

      log.info('Processing chat media upload', {
        userId: currentUser.id,
        conversationId: body.conversationId,
        messageType: body.messageType,
        mimeType: file?.mimetype,
        size: file?.size
      });

      log.info('📍 Step 1: Starting file upload process');

      const parseNumber = (value?: number | string) => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }
        const num = typeof value === 'string' ? Number(value) : value;
        return Number.isNaN(num) ? undefined : num;
      };

      const parseWaveform = (value?: string) => {
        if (!value) {
          return undefined;
        }

        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map(entry => Number(entry)).filter(entry => !Number.isNaN(entry));
          }
        } catch (error) {
          log.warn('Invalid waveformData JSON, skipping', error);
        }

        return undefined;
      };

      const rawMessageType = (body.messageType || 'image').toString().toLowerCase();
      const supportedTypes = ['image', 'video', 'audio', 'file', 'gif'] as const;
      const messageType = supportedTypes.includes(rawMessageType as any)
        ? (rawMessageType as (typeof supportedTypes)[number])
        : 'image';

      const rawConversationId = body.conversationId.trim();
      const hexPattern = /^[0-9a-fA-F]{24}$/;
      const isGroupConversation = rawConversationId.startsWith('group_');
      let participantIds: string[] = [];
      let recipientId: string | undefined;
      let groupId: string | undefined;
      let storageConversationId = rawConversationId;

      if (isGroupConversation) {
        groupId = rawConversationId.replace(/^group_/, '');
        storageConversationId = rawConversationId;

        const conversation = await Conversation.findOne({ conversationId: rawConversationId });
        if (!conversation) {
          throw new BadRequestError('Group conversation not found');
        }

        participantIds = conversation.participants.map(participant => participant.toString());
      } else {
        if (hexPattern.test(rawConversationId)) {
          if (rawConversationId === currentUser.id) {
            throw new BadRequestError('Cannot send media to yourself');
          }
          recipientId = rawConversationId;
        } else {
          const ids = rawConversationId
            .split('_')
            .map(id => id.trim())
            .filter(Boolean);

          if (ids.length !== 2) {
            throw new BadRequestError('Invalid conversation identifier');
          }

          if (!ids.includes(currentUser.id)) {
            throw new BadRequestError('User is not part of this conversation');
          }

          recipientId = ids[0] === currentUser.id ? ids[1] : ids[0];
        }

        storageConversationId = [currentUser.id, recipientId].sort().join('_');
      }

      const baseUrl = req ? getRequestBaseUrl(req) : undefined;
      const toAbsolute = (url?: string) => makeAbsoluteUrl(baseUrl, url);

      const storageMetadata: FileMetadata = {
        userId: currentUser.id,
        conversationId: storageConversationId,
        messageType,
        duration: parseNumber(body.duration),
        width: parseNumber(body.width),
        height: parseNumber(body.height),
        waveformData: parseWaveform(body.waveformData)
      };

      // Parse metadata
      const messageMetadata: any = {
        fileName: file.originalname,
        fileSize: file.size,
        duration: storageMetadata.duration,
        width: storageMetadata.width,
        height: storageMetadata.height,
        waveformData: storageMetadata.waveformData
      };

      // Upload file to storage
      log.info('📍 Step 2: About to upload file to storage');
      const uploadedFile = await fileStorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        storageMetadata
      );
      log.info('📍 Step 3: File uploaded successfully', { fileId: uploadedFile.fileId });

      messageMetadata.fileUrl = uploadedFile.url;
      if (uploadedFile.thumbnailUrl) {
        messageMetadata.thumbnailUrl = uploadedFile.thumbnailUrl;
      }

      messageMetadata.fileUrl = toAbsolute(messageMetadata.fileUrl) ?? messageMetadata.fileUrl;
      messageMetadata.thumbnailUrl = toAbsolute(messageMetadata.thumbnailUrl);

      const previewContentMap: Record<typeof messageType, string> = {
        image: body.caption ? `📷 ${body.caption}` : '📷 Photo',
        video: body.caption ? `🎬 ${body.caption}` : '🎬 Video',
        audio: body.caption ? `🎙️ ${body.caption}` : '🎙️ Voice note',
        file: body.caption ? `📎 ${body.caption}` : '📎 File',
        gif: body.caption ? `🎞️ ${body.caption}` : '🎞️ GIF'
      };

      const previewContent = previewContentMap[messageType];

      let savedMessage;

      log.info('📍 Step 4: About to save message to database');
      if (isGroupConversation) {
        if (!groupId) {
          throw new BadRequestError('Group ID is required');
        }

        savedMessage = await chatService.sendGroupMessage(
          currentUser.id,
          groupId,
          previewContent,
          participantIds,
          messageType,
          messageMetadata
        );
      } else {
        savedMessage = await chatService.sendDirectMessage(
          currentUser.id,
          recipientId!,
          previewContent,
          messageType,
          messageMetadata
        );
      }
      log.info('📍 Step 5: Message saved successfully', { messageId: savedMessage._id.toString() });

      const messageObject = savedMessage.toObject({ virtuals: false });
      const responseMetadata = messageObject.metadata ?? {};

      if (messageMetadata.fileUrl) {
        messageMetadata.fileUrl = toAbsolute(messageMetadata.fileUrl) ?? messageMetadata.fileUrl;
      }

      if (messageMetadata.thumbnailUrl) {
        messageMetadata.thumbnailUrl = toAbsolute(messageMetadata.thumbnailUrl) ?? messageMetadata.thumbnailUrl;
      }

      const responseMediaUrl = toAbsolute(responseMetadata.fileUrl);
      const responseThumbnailUrl = toAbsolute(responseMetadata.thumbnailUrl);

      const responseMessage = {
        ...messageObject,
        _id: savedMessage._id.toString(),
        conversationId: savedMessage.conversationId,
        senderId: savedMessage.senderId.toString(),
        recipientId: savedMessage.recipientId?.toString(),
        groupId: savedMessage.groupId?.toString(),
        sender: mapParticipant(messageObject.senderId),
        recipient: mapParticipant(messageObject.recipientId),
        mediaUrl: responseMediaUrl,
        thumbnailUrl: responseThumbnailUrl,
        metadata: responseMetadata,
        readBy: savedMessage.readBy.map(id => id.toString()),
        deliveredTo: savedMessage.deliveredTo.map(id => id.toString()),
        content: chatService.decryptMessageContent(savedMessage.encryptedContent, savedMessage.iv),
        encryptedContent: undefined,
        iv: undefined,
        status: 'delivered',
        timestamp: savedMessage.createdAt
      };

      emitToUser(currentUser.id, 'message:sent', responseMessage);

      log.info('📍 Step 6: About to emit socket events');
      if (savedMessage.groupId) {
        emitToGroup(savedMessage.groupId.toString(), 'group:message:receive', responseMessage);
      } else if (savedMessage.recipientId) {
        emitToUser(savedMessage.recipientId.toString(), 'message:receive', responseMessage);
      }
      log.info('📍 Step 7: Socket events emitted successfully');

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileId: uploadedFile.fileId,
          mediaUrl: toAbsolute(uploadedFile.url) ?? uploadedFile.url,
          thumbnailUrl: toAbsolute(uploadedFile.thumbnailUrl),
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          metadata: responseMetadata,
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

  /**
   * Stream media file
   * GET /api/chat/files/:fileId
   */
  @Get('/files/:fileId')
  async streamFile(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('fileId') fileId: string,
    @Res() res: Response
  ) {
    try {
      const result = await fileStorageService.downloadFromGridFS(fileId);

      res.setHeader('Content-Type', result.metadata?.contentType || 'application/octet-stream');
      if (result.metadata?.length) {
        res.setHeader('Content-Length', result.metadata.length);
      }

      res.setHeader('Cache-Control', 'public, max-age=31536000');

      result.stream.on('error', error => {
        log.error('Error streaming file:', error);
        res.destroy(error);
      });

      result.stream.pipe(res);
      return res;
    } catch (error: any) {
      log.error('Error downloading file:', error);
      throw new BadRequestError(error.message || 'Failed to download file');
    }
  }

  // Backward compatibility for previously stored URLs
  @Get('/download/:fileId')
  async downloadFile(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('fileId') fileId: string,
    @Res() res: Response
  ) {
    return this.streamFile(currentUser, fileId, res);
  }

  /**
   * Add reaction to message
   * POST /api/chat/messages/:messageId/react
   */
  @Post('/messages/:messageId/react')
  async addReaction(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('messageId') messageId: string,
    @Body() body: { emoji: string }
  ) {
    try {
      if (!body.emoji || body.emoji.length === 0) {
        throw new BadRequestError('Emoji is required');
      }

      const message = await chatService.addReaction(messageId, currentUser.id, body.emoji);

      return {
        success: true,
        message: 'Reaction added',
        data: {
          reactions: message.reactions
        }
      };
    } catch (error: any) {
      log.error('Error adding reaction:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Remove reaction from message
   * DELETE /api/chat/messages/:messageId/react
   */
  @Delete('/messages/:messageId/react')
  async removeReaction(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('messageId') messageId: string,
    @QueryParam('emoji') emoji: string
  ) {
    try {
      if (!emoji || emoji.length === 0) {
        throw new BadRequestError('Emoji is required');
      }

      const message = await chatService.removeReaction(messageId, currentUser.id, emoji);

      return {
        success: true,
        message: 'Reaction removed',
        data: {
          reactions: message.reactions
        }
      };
    } catch (error: any) {
      log.error('Error removing reaction:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Forward message to another conversation
   * POST /api/chat/messages/:messageId/forward
   */
  @Post('/messages/:messageId/forward')
  async forwardMessage(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('messageId') messageId: string,
    @Body() body: { conversationId: string }
  ) {
    try {
      if (!body.conversationId) {
        throw new BadRequestError('Conversation ID is required');
      }

      const forwardedMessage = await chatService.forwardMessage(messageId, currentUser.id, body.conversationId);

      return {
        success: true,
        message: 'Message forwarded',
        data: {
          ...forwardedMessage.toObject(),
          content: chatService.decryptMessageContent(forwardedMessage.encryptedContent, forwardedMessage.iv),
          encryptedContent: undefined,
          iv: undefined
        }
      };
    } catch (error: any) {
      log.error('Error forwarding message:', error);
      throw new BadRequestError(error.message);
    }
  }
}
