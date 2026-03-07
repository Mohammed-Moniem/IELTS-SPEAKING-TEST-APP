import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { TestSimulationController } from '../../../../../src/api/controllers/TestSimulationController';
import { TestSimulationService } from '../../../../../src/api/services/TestSimulationService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const accessToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  plan: 'premium',
  roles: []
});

describe('TestSimulationController runtime contract', () => {
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
      controllers: [TestSimulationController],
      defaultErrorHandler: false
    });

  it('keeps runtime get, advance, answer, and retry contracts stable', async () => {
    const runtimePayload = {
      simulationId: '507f1f77bcf86cd799439013',
      status: 'in_progress',
      runtime: {
        state: 'part1-examiner',
        currentPart: 1,
        currentTurnIndex: 0,
        retryCount: 0,
        currentSegment: {
          kind: 'dynamic_prompt',
          text: 'Do you live in a house or an apartment?'
        }
      }
    };

    const mockSimulationService = {
      getRuntime: jest.fn().mockResolvedValue(runtimePayload),
      advanceRuntime: jest.fn().mockResolvedValue({
        ...runtimePayload,
        runtime: {
          ...runtimePayload.runtime,
          state: 'part1-candidate-turn'
        }
      }),
      submitRuntimeAnswer: jest.fn().mockResolvedValue({
        ...runtimePayload,
        runtime: {
          ...runtimePayload.runtime,
          state: 'part1-examiner',
          currentSegment: {
            kind: 'dynamic_prompt',
            text: 'Could you tell me a little more about that?'
          }
        }
      }),
      retryRuntimeStep: jest.fn().mockResolvedValue({
        ...runtimePayload,
        runtime: {
          ...runtimePayload.runtime,
          state: 'part1-candidate-turn',
          retryCount: 0
        }
      })
    } as unknown as TestSimulationService;

    Container.set({ id: TestSimulationService, value: mockSimulationService });

    const app = createApp();

    const getRuntimeResponse = await request(app)
      .get('/api/v1/test-simulations/507f1f77bcf86cd799439013/runtime')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-runtime-get');

    expect(getRuntimeResponse.status).toBe(200);
    expect(getRuntimeResponse.body.success).toBe(true);
    expect(getRuntimeResponse.body.data).toMatchObject({
      simulationId: '507f1f77bcf86cd799439013',
      runtime: expect.objectContaining({
        state: 'part1-examiner',
        currentSegment: expect.objectContaining({
          kind: 'dynamic_prompt'
        })
      })
    });

    const advanceResponse = await request(app)
      .post('/api/v1/test-simulations/507f1f77bcf86cd799439013/runtime/advance')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-runtime-advance')
      .send({});

    expect(advanceResponse.status).toBe(200);
    expect(advanceResponse.body.success).toBe(true);
    expect(advanceResponse.body.data.runtime.state).toBe('part1-candidate-turn');

    const answerResponse = await request(app)
      .post('/api/v1/test-simulations/507f1f77bcf86cd799439013/runtime/answer')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-runtime-answer')
      .send({
        transcript: 'I live in an apartment in the city centre.',
        durationSeconds: 9
      });

    expect(answerResponse.status).toBe(200);
    expect(answerResponse.body.success).toBe(true);
    expect(answerResponse.body.data.runtime.currentSegment.text).toContain('little more');
    expect(mockSimulationService.submitRuntimeAnswer).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439013',
      {
        transcript: 'I live in an apartment in the city centre.',
        durationSeconds: 9
      },
      expect.objectContaining({ urc: 'simulation-runtime-answer' })
    );

    const retryResponse = await request(app)
      .post('/api/v1/test-simulations/507f1f77bcf86cd799439013/runtime/retry')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-runtime-retry')
      .send({});

    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.success).toBe(true);
    expect(retryResponse.body.data.runtime.state).toBe('part1-candidate-turn');
  });
});
