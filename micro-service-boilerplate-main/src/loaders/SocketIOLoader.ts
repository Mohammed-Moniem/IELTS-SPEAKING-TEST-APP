import { env } from '@env';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { encryptionService } from '../api/services/EncryptionService';
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

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, env.auth.jwtSecret || 'your-secret-key') as any;

      if (!decoded || !decoded.userId) {
        return next(new Error('Invalid token'));
      }

      // Attach user info to socket
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;

      log.info(`Socket authenticated for user: ${decoded.userId}`);
      next();
    } catch (error) {
      log.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    log.info(`User connected: ${userId} (Socket: ${socket.id})`);

    // Track user connections
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    activeUsers.set(userId, socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Notify user's friends that they're online
    socket.broadcast.emit('user:online', { userId });

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
          // Encrypt message content
          const { encryptedContent, iv } = encryptionService.encryptMessage(data.content);

          const encryptedMessage = {
            senderId: userId,
            recipientId: data.recipientId,
            encryptedContent,
            iv,
            messageType: data.messageType || 'text',
            metadata: data.metadata,
            timestamp: new Date(),
            conversationId: data.conversationId || generateConversationId(userId, data.recipientId)
          };

          // Emit to recipient(s)
          io!.to(`user:${data.recipientId}`).emit('message:receive', encryptedMessage);

          // Send confirmation to sender
          socket.emit('message:sent', {
            ...encryptedMessage,
            status: 'delivered'
          });

          log.info(`Message sent from ${userId} to ${data.recipientId}`);
        } catch (error) {
          log.error('Error sending message:', error);
          socket.emit('message:error', { error: 'Failed to send message' });
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
          // Encrypt message content
          const { encryptedContent, iv } = encryptionService.encryptMessage(data.content);

          const encryptedMessage = {
            senderId: userId,
            groupId: data.groupId,
            encryptedContent,
            iv,
            messageType: data.messageType || 'text',
            metadata: data.metadata,
            timestamp: new Date(),
            conversationId: `group_${data.groupId}`
          };

          // Emit to all group members
          io!.to(`group:${data.groupId}`).emit('group:message:receive', encryptedMessage);

          log.info(`Group message sent by ${userId} to group ${data.groupId}`);
        } catch (error) {
          log.error('Error sending group message:', error);
          socket.emit('group:message:error', { error: 'Failed to send group message' });
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

    // Typing indicators
    socket.on('typing:start', (data: { recipientId?: string; groupId?: string }) => {
      if (data.recipientId) {
        io!.to(`user:${data.recipientId}`).emit('typing:indicator', {
          userId,
          isTyping: true
        });
      } else if (data.groupId) {
        socket.to(`group:${data.groupId}`).emit('typing:indicator', {
          userId,
          groupId: data.groupId,
          isTyping: true
        });
      }
    });

    socket.on('typing:stop', (data: { recipientId?: string; groupId?: string }) => {
      if (data.recipientId) {
        io!.to(`user:${data.recipientId}`).emit('typing:indicator', {
          userId,
          isTyping: false
        });
      } else if (data.groupId) {
        socket.to(`group:${data.groupId}`).emit('typing:indicator', {
          userId,
          groupId: data.groupId,
          isTyping: false
        });
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
    socket.on('disconnect', () => {
      log.info(`User disconnected: ${userId} (Socket: ${socket.id})`);

      // Remove socket from user's socket set
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);

        // If user has no more active connections, mark as offline
        if (sockets.size === 0) {
          userSockets.delete(userId);
          activeUsers.delete(userId);

          // Notify friends that user is offline
          socket.broadcast.emit('user:offline', { userId });
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
 * Generate a consistent conversation ID for 1-on-1 chats
 * Ensures both users use the same conversation ID regardless of who initiated
 */
function generateConversationId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
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

/**
 * Get socket connection count for a user
 */
export function getUserConnectionCount(userId: string): number {
  return userSockets.get(userId)?.size || 0;
}
