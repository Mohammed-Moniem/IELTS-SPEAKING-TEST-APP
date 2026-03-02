import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { FriendController } from '../../../../../src/api/controllers/FriendController';
import { NotificationService } from '../../../../../src/api/services/NotificationService';
import { friendService } from '../../../../../src/api/services/FriendService';

jest.mock('../../../../../src/loaders/SocketIOLoader', () => ({
  emitToUser: jest.fn(),
  isUserOnline: jest.fn(() => false)
}));

const socketLoader = jest.requireMock('../../../../../src/loaders/SocketIOLoader');

describe('FriendController', () => {
  const currentUser = {
    id: '507f1f77bcf86cd799439011',
    email: 'learner@example.com'
  };

  beforeAll(() => {
    useContainer(Container);
  });

  afterEach(() => {
    Container.reset();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const createApp = () =>
    createExpressServer({
      routePrefix: '/api/v1',
      controllers: [FriendController],
      currentUserChecker: () => currentUser,
      defaultErrorHandler: false
    });

  it('sends offline push for friend request', async () => {
    const mockNotificationService = {
      notifyFriendRequest: jest.fn().mockResolvedValue(undefined),
      notifyFriendAccepted: jest.fn().mockResolvedValue(undefined)
    } as unknown as NotificationService;

    Container.set({ id: NotificationService, value: mockNotificationService });
    jest.spyOn(friendService, 'sendFriendRequest').mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      senderId: currentUser.id,
      receiverId: '507f1f77bcf86cd799439012',
      status: 'pending'
    } as any);

    const app = createApp();
    const response = await request(app).post('/api/v1/friends/request').send({
      recipientId: '507f1f77bcf86cd799439012',
      message: 'Let us practice together'
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(socketLoader.emitToUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      'friend:request:receive',
      expect.objectContaining({
        senderId: currentUser.id
      })
    );
    expect((mockNotificationService as any).notifyFriendRequest).toHaveBeenCalledWith({
      recipientId: '507f1f77bcf86cd799439012',
      senderId: currentUser.id,
      requestId: '507f1f77bcf86cd799439099'
    });
  });

  it('emits acceptance event and sends offline acceptance push', async () => {
    const mockNotificationService = {
      notifyFriendRequest: jest.fn().mockResolvedValue(undefined),
      notifyFriendAccepted: jest.fn().mockResolvedValue(undefined)
    } as unknown as NotificationService;

    Container.set({ id: NotificationService, value: mockNotificationService });
    jest.spyOn(friendService, 'acceptFriendRequest').mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      senderId: {
        toString: () => '507f1f77bcf86cd799439013'
      },
      receiverId: {
        toString: () => currentUser.id
      }
    } as any);

    const app = createApp();
    const response = await request(app).post('/api/v1/friends/accept/507f1f77bcf86cd799439099');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(socketLoader.emitToUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439013',
      'friend:request:accepted',
      expect.objectContaining({
        requestId: '507f1f77bcf86cd799439099',
        accepterId: currentUser.id
      })
    );
    expect((mockNotificationService as any).notifyFriendAccepted).toHaveBeenCalledWith({
      recipientId: '507f1f77bcf86cd799439013',
      accepterId: currentUser.id,
      requestId: '507f1f77bcf86cd799439099'
    });
  });
});
