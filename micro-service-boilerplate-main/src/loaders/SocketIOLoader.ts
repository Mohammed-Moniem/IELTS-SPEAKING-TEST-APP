import { env } from '@env';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';
import Container from 'typedi';
import { Conversation, IChatMessage } from '../api/models/ChatMessageModel';
import { UserStatus } from '../api/models/UserStatusModel';
import { chatService } from '../api/services/ChatService';
import { NotificationService } from '../api/services/NotificationService';
import { friendService } from '../api/services/FriendService';
import { Logger } from '../lib/logger';

const log = new Logger(__filename);

export let io: SocketIOServer | null = null;

// Store active user connections
const activeUsers = new Map<string, string>(); // userId -> socketId
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds (multiple devices)

/**
 * Initialize Socket.io server with authentication and encryption
 * @param httpServer - Express HTTP server
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.app.corsOrigin === '*' ? true : env.app.corsOrigin,
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      log.info(`Socket auth attempt - Token present: ${!!token}, Length: ${token?.length || 0}`);

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token with issuer check
      const decoded = jwt.verify(token, env.jwt.accessSecret, {
        issuer: env.app.name
      }) as any;

      log.info(`Socket JWT decoded successfully:`, JSON.stringify(decoded, null, 2));

      if (!decoded || !decoded.sub) {
        log.error(
          'Socket auth failed - Invalid decoded token structure. Full token:',
          JSON.stringify(decoded, null, 2)
        );
        return next(new Error('Invalid token'));
      }

      // Attach user info to socket (sub is the userId in JWT)
      socket.data.userId = decoded.sub;
      socket.data.email = decoded.email;

      log.info(`Socket authenticated for user: ${decoded.sub}`);
      next();
    } catch (error) {
      log.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: Socket) => {
    const notificationService = Container.get(NotificationService);
    const userId = socket.data.userId;
    log.info(`User connected: ${userId} (Socket: ${socket.id})`);

    // Track user connections
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    activeUsers.set(userId, socket.id);

    // Update user status in database
    try {
      await UserStatus.findOneAndUpdate(
        { userId },
        {
          $set: { isOnline: true, lastSeen: new Date() },
          $addToSet: { socketIds: socket.id },
          $setOnInsert: { userId, currentlyTypingIn: [] }
        },
        { upsert: true, new: true }
      );

      // Notify user's friends that they're online
      const friends = await friendService.getFriends(userId);
      friends.forEach(friend => {
        const friendUserId = (friend as any).userId?.toString() || (friend as any)._id?.toString();
        if (friendUserId) {
          io!.to(`user:${friendUserId}`).emit('user:online', {
            userId,
            timestamp: new Date()
          });
        }
      });
    } catch (error) {
      log.error('Error updating user status:', error);
    }

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle direct messages (1-on-1 chat)
    socket.on(
      'message:send',
      async (data: {
        recipientId: string;
        content: string;
        conversationId?: string;
        messageType?: 'text' | 'image' | 'audio' | 'file';
        metadata?: any;
      }) => {
        try {
          const savedMessage = await chatService.sendDirectMessage(
            userId,
            data.recipientId,
            data.content,
            data.messageType || 'text',
            data.metadata
          );

          const payload = buildSocketMessagePayload(savedMessage, data.content);

          io!.to(`user:${data.recipientId}`).emit('message:receive', payload);

          socket.emit('message:sent', payload);

          log.info(`Message sent from ${userId} to ${data.recipientId}`);

          if (getUserConnectionCount(data.recipientId) === 0) {
            notificationService
              .notifyDirectMessage({
                recipientId: data.recipientId,
                senderId: userId,
                message: data.content,
                conversationId: payload.conversationId
              })
              .catch(error => log.error('Failed to enqueue direct message notification', error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          log.error('Error sending message:', errorMessage, errorStack);
          socket.emit('message:error', { error: errorMessage || 'Failed to send message' });
        }
      }
    );

    // Handle group messages
    socket.on(
      'group:message:send',
      async (data: {
        groupId: string;
        content: string;
        messageType?: 'text' | 'image' | 'audio' | 'file';
        metadata?: any;
      }) => {
        try {
          const conversationId = `group_${data.groupId}`;
          const conversation = await Conversation.findOne({ conversationId });
          const participantIds = conversation
            ? conversation.participants.map(participant => participant.toString())
            : [userId];

          const savedMessage = await chatService.sendGroupMessage(
            userId,
            data.groupId,
            data.content,
            participantIds,
            data.messageType || 'text',
            data.metadata
          );

          const payload = buildSocketMessagePayload(savedMessage, data.content);

          // Emit only to the group room (includes sender if they've joined)
          io!.to(`group:${data.groupId}`).emit('group:message:receive', payload);

          log.info(`Group message sent by ${userId} to group ${data.groupId}`);

          const offlineMembers = participantIds.filter(
            memberId => memberId !== userId && getUserConnectionCount(memberId) === 0
          );

          if (offlineMembers.length > 0) {
            notificationService
              .notifyGroupMessage({
                recipientIds: offlineMembers,
                senderId: userId,
                message: data.content,
                groupId: data.groupId
              })
              .catch(error => log.error('Failed to enqueue group message notification', error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          log.error('Error sending group message:', errorMessage, errorStack);
          socket.emit('group:message:error', { error: errorMessage || 'Failed to send group message' });
        }
      }
    );

    // Join study group room
    socket.on('group:join', (groupId: string) => {
      socket.join(`group:${groupId}`);
      log.info(`User ${userId} joined group ${groupId}`);

      // Notify other group members
      socket.to(`group:${groupId}`).emit('group:member:joined', {
        userId,
        groupId,
        timestamp: new Date()
      });
    });

    // Leave study group room
    socket.on('group:leave', (groupId: string) => {
      socket.leave(`group:${groupId}`);
      log.info(`User ${userId} left group ${groupId}`);

      // Notify other group members
      socket.to(`group:${groupId}`).emit('group:member:left', {
        userId,
        groupId,
        timestamp: new Date()
      });
    });

    // Typing indicators with database tracking
    socket.on('typing:start', async (data: { conversationId: string; recipientId?: string; groupId?: string }) => {
      try {
        // Update typing status in database
        await UserStatus.findOneAndUpdate({ userId }, { $addToSet: { currentlyTypingIn: data.conversationId } });

        if (data.recipientId) {
          io!.to(`user:${data.recipientId}`).emit('typing:indicator', {
            userId,
            conversationId: data.conversationId,
            isTyping: true
          });
        } else if (data.groupId) {
          socket.to(`group:${data.groupId}`).emit('typing:indicator', {
            userId,
            groupId: data.groupId,
            conversationId: data.conversationId,
            isTyping: true
          });
        }
      } catch (error) {
        log.error('Error handling typing:start:', error);
      }
    });

    socket.on('typing:stop', async (data: { conversationId: string; recipientId?: string; groupId?: string }) => {
      try {
        // Remove typing status from database
        await UserStatus.findOneAndUpdate({ userId }, { $pull: { currentlyTypingIn: data.conversationId } });

        if (data.recipientId) {
          io!.to(`user:${data.recipientId}`).emit('typing:indicator', {
            userId,
            conversationId: data.conversationId,
            isTyping: false
          });
        } else if (data.groupId) {
          socket.to(`group:${data.groupId}`).emit('typing:indicator', {
            userId,
            groupId: data.groupId,
            conversationId: data.conversationId,
            isTyping: false
          });
        }
      } catch (error) {
        log.error('Error handling typing:stop:', error);
      }
    });

    // Read receipts
    socket.on('message:read', (data: { messageId: string; senderId: string }) => {
      io!.to(`user:${data.senderId}`).emit('message:read:confirm', {
        messageId: data.messageId,
        readBy: userId,
        readAt: new Date()
      });
    });

    // Friend request notifications
    socket.on('friend:request:send', (data: { recipientId: string }) => {
      io!.to(`user:${data.recipientId}`).emit('friend:request:receive', {
        senderId: userId,
        timestamp: new Date()
      });
    });

    // Online status check
    socket.on('status:check', (userIds: string[]) => {
      const onlineUsers = userIds.filter(id => activeUsers.has(id));
      socket.emit('status:response', { onlineUsers });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      log.info(`User disconnected: ${userId} (Socket: ${socket.id})`);

      // Remove socket from user's socket set
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);

        // Update database: remove this socketId
        try {
          await UserStatus.findOneAndUpdate(
            { userId },
            {
              $pull: { socketIds: socket.id },
              $set: { lastSeen: new Date() }
            }
          );
        } catch (error) {
          log.error('Error updating user status on disconnect:', error);
        }

        // If user has no more active connections, mark as offline
        if (sockets.size === 0) {
          userSockets.delete(userId);
          activeUsers.delete(userId);

          try {
            // Update status to offline in database
            await UserStatus.findOneAndUpdate(
              { userId },
              {
                $set: {
                  isOnline: false,
                  lastSeen: new Date(),
                  currentlyTypingIn: [], // Clear typing indicators
                  socketIds: []
                }
              }
            );

            // Notify friends that user is offline
            const friends = await friendService.getFriends(userId);
            friends.forEach(friend => {
              const friendUserId = (friend as any).userId?.toString() || (friend as any)._id?.toString();
              if (friendUserId) {
                io!.to(`user:${friendUserId}`).emit('user:offline', {
                  userId,
                  lastSeen: new Date()
                });
              }
            });
          } catch (error) {
            log.error('Error marking user offline:', error);
          }
        }
      }
    });

    // Error handling
    socket.on('error', error => {
      log.error(`Socket error for user ${userId}:`, error);
    });
  });

  log.info('Socket.io server initialized successfully');
  return io;
}

/**
 * Emit event to specific user(s)
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Emit event to specific group
 */
export function emitToGroup(groupId: string, event: string, data: any) {
  if (io) {
    io.to(`group:${groupId}`).emit(event, data);
  }
}

/**
 * Check if user is currently online
 */
export function isUserOnline(userId: string): boolean {
  return activeUsers.has(userId);
}

/**
 * Get all online users
 */
export function getOnlineUsers(): string[] {
  return Array.from(activeUsers.keys());
}

function buildSocketMessagePayload(message: IChatMessage, plainContent: string) {
  const readBy = Array.isArray(message.readBy) ? message.readBy.map(id => id.toString()) : [];
  const deliveredTo = Array.isArray(message.deliveredTo) ? message.deliveredTo.map(id => id.toString()) : [];
  const metadata = (message.metadata || {}) as Record<string, any>;

  return {
    _id: message._id.toString(),
    senderId: message.senderId?.toString(),
    recipientId: message.recipientId?.toString(),
    groupId: message.groupId?.toString(),
    conversationId: message.conversationId,
    content: plainContent,
    encryptedContent: message.encryptedContent,
    iv: message.iv,
    messageType: message.messageType,
    metadata,
    mediaUrl: metadata.fileUrl,
    thumbnailUrl: metadata.thumbnailUrl,
    readBy,
    deliveredTo,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    timestamp: message.createdAt,
    status: 'delivered'
  };
}

/**
 * Get socket connection count for a user
 */
export function getUserConnectionCount(userId: string): number {
  return userSockets.get(userId)?.size || 0;
}
