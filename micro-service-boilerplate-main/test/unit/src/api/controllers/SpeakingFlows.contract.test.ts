import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { PracticeController } from '../../../../../src/api/controllers/PracticeController';
import { TestSimulationController } from '../../../../../src/api/controllers/TestSimulationController';
import { TopicController } from '../../../../../src/api/controllers/TopicController';
import { AuthMiddleware } from '../../../../../src/api/middlewares/AuthMiddleware';
import { AudioService } from '../../../../../src/api/services/AudioService';
import { IELTSQuestionService } from '../../../../../src/api/services/IELTSQuestionService';
import { PracticeService } from '../../../../../src/api/services/PracticeService';
import { TestSimulationService } from '../../../../../src/api/services/TestSimulationService';
import { TopicGenerationService } from '../../../../../src/api/services/TopicGenerationService';
import { TopicService } from '../../../../../src/api/services/TopicService';
import { TranscriptionService } from '../../../../../src/api/services/TranscriptionService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const testUserId = '507f1f77bcf86cd799439011';
const accessToken = generateAccessToken({
  sub: testUserId,
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('Speaking flows compatibility contract', () => {
  beforeAll(() => {
    useContainer(Container);
  });

  afterEach(() => {
    Container.reset();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const createSpeakingFlowApp = () =>
    createExpressServer({
      routePrefix: '/api/v1',
      controllers: [PracticeController, TestSimulationController],
      defaultErrorHandler: false
    });

  const createTopicsApp = () =>
    createExpressServer({
      routePrefix: '/api/v1',
      controllers: [TopicController],
      middlewares: [AuthMiddleware],
      defaultErrorHandler: false
    });

  it('keeps /practice/sessions start and complete contracts stable', async () => {
    const mockPracticeService = {
      startSession: jest.fn().mockResolvedValue({
        sessionId: '507f1f77bcf86cd799439012',
        question: 'Describe a memorable trip.',
        timeLimit: 120,
        tips: ['Give specific details'],
        topic: {
          slug: 'memorable-trip',
          title: 'Memorable Trip',
          part: 2
        }
      }),
      completeSession: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        topicId: 'memorable-trip',
        status: 'completed',
        feedback: {
          overallBand: 6.5,
          summary: 'Clear response with room for better lexical variety.',
          improvements: ['Use a wider range of collocations']
        }
      }),
      getSessionDetail: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        topicId: 'memorable-trip',
        topicTitle: 'Memorable Trip',
        question: 'Describe a memorable trip.',
        status: 'completed',
        userResponse: 'I travelled to Istanbul and learned a lot.',
        feedback: {
          overallBand: 6.5,
          summary: 'Clear response with room for better lexical variety.',
          strengths: ['Natural storytelling'],
          improvements: ['Use a wider range of collocations'],
          bandBreakdown: {
            pronunciation: 6.5,
            fluency: 6.5,
            lexicalResource: 6.0,
            grammaticalRange: 6.5
          }
        }
      })
    } as unknown as PracticeService;

    Container.set({ id: PracticeService, value: mockPracticeService });
    Container.set({ id: AudioService, value: {} as AudioService });
    Container.set({ id: TranscriptionService, value: {} as TranscriptionService });

    const app = createSpeakingFlowApp();

    const startResponse = await request(app)
      .post('/api/v1/practice/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'practice-start-contract')
      .send({ topicId: 'memorable-trip' });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body.success).toBe(true);
    expect(startResponse.body.message).toBe('Practice session started');
    expect(startResponse.body.data).toMatchObject({
      sessionId: '507f1f77bcf86cd799439012',
      question: expect.any(String),
      timeLimit: expect.any(Number),
      tips: expect.any(Array),
      topic: expect.any(Object)
    });
    expect(mockPracticeService.startSession).toHaveBeenCalledWith(
      testUserId,
      'memorable-trip',
      expect.objectContaining({ urc: 'practice-start-contract' })
    );

    const completeResponse = await request(app)
      .post('/api/v1/practice/sessions/507f1f77bcf86cd799439012/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'practice-complete-contract')
      .send({
        userResponse: 'I travelled to Istanbul last year and explored the old city with my family.',
        timeSpent: 93
      });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.message).toBe('Practice session completed');
    expect(completeResponse.body.data).toMatchObject({
      _id: '507f1f77bcf86cd799439012',
      status: 'completed',
      feedback: expect.objectContaining({
        overallBand: expect.any(Number),
        summary: expect.any(String)
      })
    });
    expect(mockPracticeService.completeSession).toHaveBeenCalledWith(
      testUserId,
      '507f1f77bcf86cd799439012',
      expect.any(String),
      93,
      expect.objectContaining({ urc: 'practice-complete-contract' })
    );

    const detailResponse = await request(app)
      .get('/api/v1/practice/sessions/507f1f77bcf86cd799439012')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'practice-detail-contract');

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(detailResponse.body.data).toMatchObject({
      _id: '507f1f77bcf86cd799439012',
      topicTitle: 'Memorable Trip',
      feedback: expect.objectContaining({
        overallBand: 6.5
      })
    });
    expect(mockPracticeService.getSessionDetail).toHaveBeenCalledWith(
      testUserId,
      '507f1f77bcf86cd799439012',
      expect.objectContaining({ urc: 'practice-detail-contract' })
    );
  });

  it('keeps /test-simulations start/complete/list/detail contracts stable', async () => {
    const startedSimulation = {
      simulationId: '507f1f77bcf86cd799439013',
      sessionPackage: {
        version: 1,
        examinerProfile: {
          id: 'british',
          accent: 'British'
        },
        segments: [
          {
            segmentId: 'fixed:welcome_intro',
            audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3'
          }
        ]
      },
      parts: [
        { part: 1, question: 'Part 1 question', timeLimit: 60, tips: ['Keep it concise'] },
        { part: 2, question: 'Part 2 cue card', timeLimit: 180, tips: ['Cover all bullet points'] },
        { part: 3, question: 'Part 3 discussion', timeLimit: 90, tips: ['Support your opinions'] }
      ]
    };

    const completedSimulation = {
      _id: '507f1f77bcf86cd799439013',
      status: 'completed',
      overallBand: 6.5,
      overallFeedback: {
        summary: 'Consistent speaking performance with steady fluency.'
      },
      parts: [
        { part: 1, feedback: { overallBand: 6.5, summary: 'Good fluency' } },
        { part: 2, feedback: { overallBand: 6.0, summary: 'Needs richer vocabulary' } },
        { part: 3, feedback: { overallBand: 7.0, summary: 'Strong argumentation' } }
      ]
    };

    const mockSimulationService = {
      startSimulation: jest.fn().mockResolvedValue(startedSimulation),
      completeSimulation: jest.fn().mockResolvedValue(completedSimulation),
      paginateOptions: jest.fn().mockReturnValue({ limit: 5, offset: 0 }),
      listSimulations: jest.fn().mockResolvedValue([completedSimulation]),
      getSimulation: jest.fn().mockResolvedValue(completedSimulation)
    } as unknown as TestSimulationService;

    Container.set({ id: TestSimulationService, value: mockSimulationService });

    const app = createSpeakingFlowApp();

    const startResponse = await request(app)
      .post('/api/v1/test-simulations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-start-contract')
      .send({});

    expect(startResponse.status).toBe(201);
    expect(startResponse.body.success).toBe(true);
    expect(startResponse.body.message).toBe('Simulation started');
    expect(startResponse.body.data).toMatchObject({
      simulationId: '507f1f77bcf86cd799439013',
      sessionPackage: expect.objectContaining({
        examinerProfile: expect.objectContaining({
          id: 'british'
        }),
        segments: expect.arrayContaining([
          expect.objectContaining({
            segmentId: 'fixed:welcome_intro',
            audioUrl: expect.any(String)
          })
        ])
      }),
      parts: expect.any(Array)
    });
    expect(mockSimulationService.startSimulation).toHaveBeenCalledWith(
      testUserId,
      expect.objectContaining({ urc: 'simulation-start-contract' })
    );

    const completeResponse = await request(app)
      .post('/api/v1/test-simulations/507f1f77bcf86cd799439013/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-complete-contract')
      .send({
        parts: [
          { part: 1, question: 'Part 1 question', response: 'Response 1', timeSpent: 42 },
          { part: 2, question: 'Part 2 cue card', response: 'Response 2', timeSpent: 135 },
          { part: 3, question: 'Part 3 discussion', response: 'Response 3', timeSpent: 81 }
        ]
      });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.message).toBe('Simulation completed');
    expect(completeResponse.body.data).toMatchObject({
      _id: '507f1f77bcf86cd799439013',
      status: 'completed',
      overallBand: expect.any(Number)
    });

    const listResponse = await request(app)
      .get('/api/v1/test-simulations?limit=5&offset=0')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-list-contract');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data).toHaveLength(1);
    expect(mockSimulationService.paginateOptions).toHaveBeenCalledWith(5, 0);
    expect(mockSimulationService.listSimulations).toHaveBeenCalledWith(testUserId, { limit: 5, offset: 0 });

    const detailResponse = await request(app)
      .get('/api/v1/test-simulations/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'simulation-detail-contract');

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(detailResponse.body.data).toMatchObject({
      _id: '507f1f77bcf86cd799439013',
      status: 'completed'
    });
  });

  it('keeps /topics/practice and /topics/get-random contracts stable', async () => {
    const topicDocument = {
      toObject: () => ({
        slug: 'art-and-culture',
        title: 'Art and Culture',
        description: 'Describe an exhibition you enjoyed.',
        part: 2
      })
    };

    const mockTopicService = {
      getTopicsWithPagination: jest.fn().mockResolvedValue({
        topics: [topicDocument],
        total: 1,
        hasMore: false
      })
    } as unknown as TopicService;

    const mockQuestionBank = {
      getRandomTopicFromBank: jest.fn().mockResolvedValue({
        questionId: 'question-1',
        question: 'Describe a painting you admire.',
        category: 'part1',
        difficulty: 'medium',
        keywords: ['art']
      })
    } as unknown as IELTSQuestionService;

    const mockTopicGeneration = {
      generateRandomTopic: jest.fn(),
      getCommonTopics: jest.fn().mockReturnValue(['family', 'work', 'education'])
    } as unknown as TopicGenerationService;

    Container.set({ id: TopicService, value: mockTopicService });
    Container.set({ id: IELTSQuestionService, value: mockQuestionBank });
    Container.set({ id: TopicGenerationService, value: mockTopicGeneration });

    const app = createTopicsApp();

    const practiceTopicsResponse = await request(app)
      .get('/api/v1/topics/practice?limit=10&offset=0&excludeCompleted=true&category=part2')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'topics-practice-contract');

    expect(practiceTopicsResponse.status).toBe(200);
    expect(practiceTopicsResponse.body.success).toBe(true);
    expect(practiceTopicsResponse.body.data).toMatchObject({
      topics: expect.any(Array),
      total: 1,
      hasMore: false,
      limit: 10,
      offset: 0
    });
    expect(mockTopicService.getTopicsWithPagination).toHaveBeenCalledWith(
      testUserId,
      10,
      0,
      true,
      'part2',
      expect.objectContaining({ urc: 'topics-practice-contract' })
    );

    const randomResponse = await request(app)
      .get('/api/v1/topics/get-random?category=part1&difficulty=medium')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'topics-random-contract');

    expect(randomResponse.status).toBe(200);
    expect(randomResponse.body.success).toBe(true);
    expect(randomResponse.body.message).toBe('Random topic retrieved from question bank');
    expect(randomResponse.body.data).toMatchObject({
      question: expect.any(String),
      category: 'part1'
    });
    expect(mockQuestionBank.getRandomTopicFromBank).toHaveBeenCalledWith(
      'part1',
      'medium',
      testUserId,
      expect.objectContaining({ urc: 'topics-random-contract' })
    );
    expect(mockTopicGeneration.generateRandomTopic).not.toHaveBeenCalled();
  });
});
