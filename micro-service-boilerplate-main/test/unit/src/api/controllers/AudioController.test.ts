import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AudioController } from '../../../../../src/api/controllers/AudioController';
import { AuthMiddleware } from '../../../../../src/api/middlewares/AuthMiddleware';
import { AudioStorageService } from '../../../../../src/api/services/AudioStorageService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const ownerId = '507f1f77bcf86cd799439011';
const nonOwnerId = '507f1f77bcf86cd799439012';

const ownerToken = generateAccessToken({
  sub: ownerId,
  email: 'owner@example.com',
  plan: 'free',
  roles: []
});

const supportAgentToken = generateAccessToken({
  sub: nonOwnerId,
  email: 'agent@example.com',
  plan: 'pro',
  roles: ['support_agent']
});

describe('AudioController', () => {
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
      controllers: [AudioController],
      middlewares: [AuthMiddleware],
      defaultErrorHandler: false
    });

  it('allows recording owner to delete recording', async () => {
    const mockService = {
      getRecordingMetadata: jest.fn().mockResolvedValue({ _id: 'rec-1', userId: ownerId }),
      deleteRecording: jest.fn().mockResolvedValue(undefined)
    } as unknown as AudioStorageService;

    Container.set({ id: AudioStorageService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/api/v1/audio/rec-1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Unique-Reference-Code', 'audio-delete-owner');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.deleteRecording).toHaveBeenCalledWith('rec-1');
  });

  it('blocks non-owner delete attempts for non-admin users', async () => {
    const mockService = {
      getRecordingMetadata: jest.fn().mockResolvedValue({ _id: 'rec-2', userId: ownerId }),
      deleteRecording: jest.fn().mockResolvedValue(undefined)
    } as unknown as AudioStorageService;

    Container.set({ id: AudioStorageService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/api/v1/audio/rec-2')
      .set('Authorization', `Bearer ${generateAccessToken({ sub: nonOwnerId, email: 'learner@example.com', plan: 'free', roles: [] })}`)
      .set('Unique-Reference-Code', 'audio-delete-forbidden');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Forbidden');
    expect(mockService.deleteRecording).not.toHaveBeenCalled();
  });

  it('allows support agent to delete another user recording', async () => {
    const mockService = {
      getRecordingMetadata: jest.fn().mockResolvedValue({ _id: 'rec-3', userId: ownerId }),
      deleteRecording: jest.fn().mockResolvedValue(undefined)
    } as unknown as AudioStorageService;

    Container.set({ id: AudioStorageService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/api/v1/audio/rec-3')
      .set('Authorization', `Bearer ${supportAgentToken}`)
      .set('Unique-Reference-Code', 'audio-delete-support');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.deleteRecording).toHaveBeenCalledWith('rec-3');
  });
});
