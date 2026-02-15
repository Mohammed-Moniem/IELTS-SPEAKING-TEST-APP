import { env } from '@env';
import { Server as HTTPServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import Container from 'typedi';

import { chatService } from '../api/services/ChatService';
import { NotificationService } from '../api/services/NotificationService';
import { friendService } from '../api/services/FriendService';
import { Logger } from '../lib/logger';
import { getCurrentUserFromAccessToken } from '../lib/supabaseAuth';
import { getSupabaseAdmin } from '../lib/supabaseClient';

const log = new Logger(__filename);

export let io: SocketIOServer | null = null;

// Store active user connections
const activeUsers = new Map<string, string>(); // userId -> socketId
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds (multiple devices)

const uniq = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)));

async function updateUserStatus(userId: string, updater: (current: any | null) => any): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('user_status').select('user_id, is_online, last_seen, socket_ids, currently_typing_in').eq('user_id', userId).maybeSingle();
  const next = updater(data as any);
  if (!data) {
    await supabase.from('user_status').insert({ user_id: userId, ...next });
    return;
  }
  await supabase.from('user_status').update(next).eq('user_id', userId);
}

function buildSocketMessagePayload(row: any) {
  const metadata = row.metadata || {};
  return {
    _id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id || undefined,
    groupId: row.group_id || undefined,
    conversationId: row.conversation_id,
    content: chatService.decryptMessageContent(row.encrypted_content, row.iv),
    messageType: row.message_type,
    metadata,
    mediaUrl: metadata.fileUrl,
    thumbnailUrl: metadata.thumbnailUrl,
    readBy: Array.isArray(row.read_by) ? row.read_by : [],
    deliveredTo: Array.isArray(row.delivered_to) ? row.delivered_to : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timestamp: row.created_at,
    status: 'delivered'
  };
}

/**
 * Initialize Socket.io server with Supabase Auth and Postgres persistence.
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

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const currentUser = await getCurrentUserFromAccessToken(token);
      socket.data.userId = currentUser.id;
      socket.data.email = currentUser.email;

      next();
    } catch (error) {
      log.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const notificationService = Container.get(NotificationService);
    const userId = socket.data.userId as string;

    log.info(`User connected: ${userId} (Socket: ${socket.id})`);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    activeUsers.set(userId, socket.id);

    socket.join(`user:${userId}`);

    // Presence: mark online + persist socket ids.
    try {
      await updateUserStatus(userId, current => {
        const existing = current || {};
        const socketIds = uniq([...(existing.socket_ids || []), socket.id]);
        return {
          is_online: true,
          last_seen: new Date().toISOString(),
          socket_ids: socketIds,
          currently_typing_in: existing.currently_typing_in || []
        };
      });

      // Notify friends.
      const friends = await friendService.getFriends(userId);
      friends.forEach(friend => {
        const friendUserId = (friend as any).userId || (friend as any)._id;
        if (friendUserId) {
          io!.to(`user:${friendUserId}`).emit('user:online', { userId, timestamp: new Date().toISOString() });
        }
      });
    } catch (error) {
      log.error('Error updating user status:', error);
    }

    socket.on('message:send', async (data: { recipientId: string; content: string; messageType?: string; metadata?: any }) => {
      try {
        const saved = await chatService.sendDirectMessage(
          userId,
          data.recipientId,
          data.content,
          (data.messageType as any) || 'text',
          data.metadata
        );

        const payload = buildSocketMessagePayload(saved);

        io!.to(`user:${data.recipientId}`).emit('message:receive', payload);
        socket.emit('message:sent', payload);

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
      } catch (error: any) {
        const msg = error instanceof Error ? error.message : 'Failed to send message';
        log.error('Error sending message:', error);
        socket.emit('message:error', { error: msg });
      }
    });

    socket.on('group:message:send', async (data: { groupId: string; content: string; messageType?: string; metadata?: any }) => {
      try {
        const groupId = data.groupId;
        const memberIds = await chatService.getGroupMemberIds(groupId);
        if (!memberIds.includes(userId)) {
          throw new Error('Not a member of this group');
        }

        const saved = await chatService.sendGroupMessage(
          userId,
          groupId,
          data.content,
          memberIds,
          (data.messageType as any) || 'text',
          data.metadata
        );

        const payload = buildSocketMessagePayload(saved);
        io!.to(`group:${groupId}`).emit('group:message:receive', payload);

        const offlineMembers = memberIds.filter(memberId => memberId !== userId && getUserConnectionCount(memberId) === 0);
        if (offlineMembers.length > 0) {
          notificationService
            .notifyGroupMessage({
              recipientIds: offlineMembers,
              senderId: userId,
              message: data.content,
              groupId
            })
            .catch(error => log.error('Failed to enqueue group message notification', error));
        }
      } catch (error: any) {
        const msg = error instanceof Error ? error.message : 'Failed to send group message';
        log.error('Error sending group message:', error);
        socket.emit('group:message:error', { error: msg });
      }
    });

    socket.on('group:join', (groupId: string) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);
    });

    socket.on('group:leave', (groupId: string) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
    });

    socket.on('conversation:join', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      socket.join(`conversation:${data.conversationId}`);
    });

    socket.on('conversation:leave', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      socket.leave(`conversation:${data.conversationId}`);
    });

    socket.on('typing:start', async (data: { conversationId: string }) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        await updateUserStatus(userId, current => {
          const existing = current || {};
          const typing = uniq([...(existing.currently_typing_in || []), conversationId]);
          return { currently_typing_in: typing, updated_at: new Date().toISOString() };
        });

        const payload = { userId, conversationId, timestamp: new Date().toISOString() };

        if (conversationId.startsWith('group_')) {
          const groupId = conversationId.replace(/^group_/, '');
          socket.to(`group:${groupId}`).emit('typing:start', payload);
        } else {
          const parts = conversationId.split('_').filter(Boolean);
          const recipientId = parts.length === 2 ? (parts[0] === userId ? parts[1] : parts[0]) : undefined;
          if (recipientId) {
            io!.to(`user:${recipientId}`).emit('typing:start', payload);
          }
        }
      } catch (error) {
        log.error('Error handling typing:start:', error);
      }
    });

    socket.on('typing:stop', async (data: { conversationId: string }) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        await updateUserStatus(userId, current => {
          const existing = current || {};
          const typing = (existing.currently_typing_in || []).filter((c: string) => c !== conversationId);
          return { currently_typing_in: typing, updated_at: new Date().toISOString() };
        });

        const payload = { userId, conversationId, timestamp: new Date().toISOString() };

        if (conversationId.startsWith('group_')) {
          const groupId = conversationId.replace(/^group_/, '');
          socket.to(`group:${groupId}`).emit('typing:stop', payload);
        } else {
          const parts = conversationId.split('_').filter(Boolean);
          const recipientId = parts.length === 2 ? (parts[0] === userId ? parts[1] : parts[0]) : undefined;
          if (recipientId) {
            io!.to(`user:${recipientId}`).emit('typing:stop', payload);
          }
        }
      } catch (error) {
        log.error('Error handling typing:stop:', error);
      }
    });

    socket.on('message:read', async (data: { messageId: string }) => {
      try {
        const messageId = data?.messageId;
        if (!messageId) return;

        await chatService.markMessageAsRead(messageId, userId);

        const supabase = getSupabaseAdmin();
        const { data: messageRow } = await supabase
          .from('chat_messages')
          .select('id, conversation_id, sender_id, recipient_id, group_id')
          .eq('id', messageId)
          .maybeSingle();

        if (!messageRow) return;

        const payload = { messageId, readBy: userId, readAt: new Date().toISOString(), conversationId: (messageRow as any).conversation_id };

        if ((messageRow as any).group_id) {
          io!.to(`group:${(messageRow as any).group_id}`).emit('message:read', payload);
        } else {
          const otherUserId = (messageRow as any).sender_id === userId ? (messageRow as any).recipient_id : (messageRow as any).sender_id;
          if (otherUserId) {
            io!.to(`user:${otherUserId}`).emit('message:read', payload);
          }
        }
      } catch (error) {
        log.error('Error handling message:read:', error);
      }
    });

    socket.on('disconnect', async () => {
      log.info(`User disconnected: ${userId} (Socket: ${socket.id})`);

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
      }

      // Persist socket id removal and presence transitions.
      try {
        await updateUserStatus(userId, current => {
          const existing = current || {};
          const socketIds = (existing.socket_ids || []).filter((sid: string) => sid !== socket.id);
          const stillOnline = socketIds.length > 0;
          return {
            is_online: stillOnline,
            last_seen: new Date().toISOString(),
            socket_ids: socketIds,
            currently_typing_in: stillOnline ? existing.currently_typing_in || [] : []
          };
        });
      } catch (error) {
        log.error('Error updating user status on disconnect:', error);
      }

      if (!sockets || sockets.size === 0) {
        userSockets.delete(userId);
        activeUsers.delete(userId);

        try {
          const friends = await friendService.getFriends(userId);
          friends.forEach(friend => {
            const friendUserId = (friend as any).userId || (friend as any)._id;
            if (friendUserId) {
              io!.to(`user:${friendUserId}`).emit('user:offline', {
                userId,
                lastSeen: new Date().toISOString()
              });
            }
          });
        } catch (error) {
          log.error('Error notifying friends on disconnect:', error);
        }
      }
    });
  });

  log.info('Socket.io server initialized successfully');
  return io;
}

export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToGroup(groupId: string, event: string, data: any) {
  if (io) {
    io.to(`group:${groupId}`).emit(event, data);
  }
}

export function isUserOnline(userId: string): boolean {
  return activeUsers.has(userId);
}

export function getOnlineUsers(): string[] {
  return Array.from(activeUsers.keys());
}

export function getUserConnectionCount(userId: string): number {
  return userSockets.get(userId)?.size || 0;
}

