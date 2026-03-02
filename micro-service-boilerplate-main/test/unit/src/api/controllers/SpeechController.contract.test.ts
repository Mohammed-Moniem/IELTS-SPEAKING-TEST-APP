import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { SpeechController } from '../../../../../src/api/controllers/SpeechController';
import { SpeechService } from '../../../../../src/api/services/SpeechService';
import { TestEvaluationService } from '../../../../../src/api/services/TestEvaluationService';
import { TestSessionService } from '../../../../../src/api/services/TestSessionService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const accessToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('SpeechController contract', () => {
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
      controllers: [SpeechController],
      defaultErrorHandler: false
    });

  it('keeps /speech/evaluate response contract stable', async () => {
    const mockSpeechService = {
      evaluateResponse: jest.fn().mockResolvedValue({
        overallBand: 6.5,
        spokenSummary: 'Strong attempt with clear organization.',
        criteria: {
          fluencyCoherence: { band: 6.5 },
          lexicalResource: { band: 6.0 },
          grammaticalRange: { band: 6.5 },
          pronunciation: { band: 6.5 }
        },
        corrections: [],
        suggestions: ['Use more varied connectors']
      })
    } as unknown as SpeechService;

    Container.set({ id: SpeechService, value: mockSpeechService });
    Container.set({ id: TestEvaluationService, value: {} as TestEvaluationService });
    Container.set({ id: TestSessionService, value: {} as TestSessionService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/speech/evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'speech-contract-success')
      .send({
        transcript: 'I enjoy reading books every day.',
        question: 'What do you do in your free time?',
        testPart: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      overallBand: 6.5,
      spokenSummary: expect.any(String),
      criteria: expect.any(Object),
      corrections: expect.any(Array),
      suggestions: expect.any(Array)
    });
  });

  it('rejects empty transcript for /speech/evaluate', async () => {
    const mockSpeechService = {
      evaluateResponse: jest.fn()
    } as unknown as SpeechService;

    Container.set({ id: SpeechService, value: mockSpeechService });
    Container.set({ id: TestEvaluationService, value: {} as TestEvaluationService });
    Container.set({ id: TestSessionService, value: {} as TestSessionService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/speech/evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'speech-contract-validation')
      .send({
        transcript: '',
        question: 'Question',
        testPart: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Transcript is required');
    expect(mockSpeechService.evaluateResponse).not.toHaveBeenCalled();
  });

  it('keeps /speech/synthesize response contract stable', async () => {
    const mockSpeechService = {
      synthesize: jest.fn().mockResolvedValue({
        buffer: Buffer.from('audio-binary'),
        voiceId: 'voice-a',
        cacheHit: false,
        cacheExpiresAt: null
      })
    } as unknown as SpeechService;

    Container.set({ id: SpeechService, value: mockSpeechService });
    Container.set({ id: TestEvaluationService, value: {} as TestEvaluationService });
    Container.set({ id: TestSessionService, value: {} as TestSessionService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/speech/synthesize')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'speech-synthesize-contract')
      .send({
        text: 'Please read this prompt aloud.',
        voiceId: 'voice-a'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        audioBase64: expect.any(String),
        mimeType: 'audio/mpeg',
        voiceId: 'voice-a',
        cacheHit: false,
        textLength: expect.any(Number)
      }
    });
  });
});
