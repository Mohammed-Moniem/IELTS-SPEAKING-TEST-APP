const mockUserFindById = jest.fn();
const mockSimulationCreate = jest.fn();
const mockSimulationFindOne = jest.fn();
const mockPreferenceLean = jest.fn();
const mockPreferenceFindOne = jest.fn(() => ({
  lean: mockPreferenceLean
}));

jest.mock('@models/UserModel', () => ({
  UserModel: {
    findById: mockUserFindById
  }
}));

jest.mock('@models/TestSimulationModel', () => ({
  TestSimulationModel: {
    create: mockSimulationCreate,
    findOne: mockSimulationFindOne
  }
}));

jest.mock('@models/TestPreferenceModel', () => ({
  TestPreferenceModel: {
    findOne: mockPreferenceFindOne
  }
}));

import { TestSimulationService } from '@services/TestSimulationService';

describe('TestSimulationService runtime contract', () => {
  const usageService = {
    assertTestAllowance: jest.fn(),
    incrementTest: jest.fn()
  };
  const feedbackService = {};
  const questionGenerationService = {
    generateCompleteTest: jest.fn()
  };
  const speechService = {
    generateExaminerResponse: jest.fn(),
    generateBufferedExaminerFollowUp: jest.fn()
  };
  const sessionPackageService = {
    buildSessionPackage: jest.fn(),
    ensurePackageReady: jest.fn()
  };

  let savedSimulation: any;

  const createService = () =>
    new TestSimulationService(
      usageService as any,
      feedbackService as any,
      questionGenerationService as any,
      speechService as any,
      sessionPackageService as any
    );

  const startThroughFirstPart1CandidateTurn = async (service: TestSimulationService) => {
    await service.startSimulation('user-1', { urc: 'test-urc' } as any);
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-1' } as any);
    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'My name is Mohammed Osman.', durationSeconds: 3 },
      { urc: 'answer-1' } as any
    );
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-2' } as any);
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-3' } as any);
    return service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-4' } as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPreferenceFindOne.mockReturnValue({
      lean: mockPreferenceLean
    });

    mockUserFindById.mockResolvedValue({
      _id: 'user-1',
      subscriptionPlan: 'premium'
    });

    mockPreferenceLean.mockResolvedValue({
      targetBand: '6.5'
    });

    questionGenerationService.generateCompleteTest.mockResolvedValue({
      part1: {
        topic: 'Home life',
        questions: [
          'Do you live in a house or an apartment?',
          'What do you like most about your home?',
          'Who do you live with?',
          'Is your neighbourhood a good place for families?'
        ],
        timeLimit: 240
      },
      part2: {
        topic: 'Travel',
        mainPrompt: 'Describe a memorable journey you have taken.',
        bulletPoints: ['Where you went', 'Who you were with'],
        preparationTime: 60,
        responseTime: 120
      },
      part3: {
        topic: 'Travel',
        questions: [
          'How has tourism changed in recent years?',
          'What are the disadvantages of mass tourism?',
          'How can governments support local communities affected by tourism?'
        ],
        timeLimit: 240
      }
    });

    mockSimulationCreate.mockImplementation(async (payload: any) => {
      savedSimulation = {
        _id: 'simulation-1',
        ...payload,
        save: jest.fn().mockImplementation(async () => savedSimulation)
      };
      return savedSimulation;
    });

    mockSimulationFindOne.mockImplementation(async () => savedSimulation);
    speechService.generateExaminerResponse.mockResolvedValue('Could you tell me a little more about that?');
    speechService.generateBufferedExaminerFollowUp.mockResolvedValue({
      text: 'Could you tell me a little more about that?',
      audioAssetId: 'asset-follow-up',
      audioUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up.mp3',
      cacheKey: 'dynamic-follow-up:british:could-you-tell-me-a-little-more-about-that',
      provider: 'openai',
      cacheHit: false
    });
    sessionPackageService.buildSessionPackage.mockResolvedValue({
      version: 1,
      preparedAt: new Date('2026-03-07T00:00:00.000Z'),
      prepareStatus: 'ready',
      requiredSegmentCount: 1,
      readySegmentCount: 1,
      examinerProfile: {
        id: 'british',
        label: 'British Examiner',
        accent: 'British',
        provider: 'openai',
        voiceId: 'alloy',
        autoAssigned: true
      },
      segments: [
        {
          segmentId: 'fixed:welcome_intro',
          part: 0,
          phase: 'check-in',
          kind: 'fixed_phrase',
          turnType: 'examiner',
          canAutoAdvance: true,
          phraseId: 'welcome_intro',
          text: 'Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?',
          audioAssetId: 'asset-welcome',
          audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
          cacheKey: 'fixed:british:welcome_intro',
          provider: 'openai',
          isReady: true,
          requiresGeneration: false
        }
      ]
    });
    sessionPackageService.ensurePackageReady.mockImplementation(async (sessionPackage: any) => sessionPackage);
  });

  it('starts a simulation with intro examiner runtime metadata', async () => {
    const service = createService();

    const result = await service.startSimulation('user-1', { urc: 'test-urc' } as any);

    expect(result.parts).toHaveLength(3);
    expect(result.sessionPackage).toEqual(
      expect.objectContaining({
        prepareStatus: 'ready',
        requiredSegmentCount: 1,
        readySegmentCount: 1,
        examinerProfile: expect.objectContaining({
          id: 'british',
          accent: 'British',
          provider: 'openai'
        }),
        segments: expect.arrayContaining([
          expect.objectContaining({
            segmentId: 'fixed:welcome_intro',
            part: 0,
            turnType: 'examiner',
            canAutoAdvance: true,
            audioAssetId: 'asset-welcome',
            audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
            isReady: true,
            requiresGeneration: false
          })
        ])
      })
    );
    expect((result as any).telemetry).toEqual(
      expect.objectContaining({
        packageBuildDurationMs: expect.any(Number),
        baseAudioAssetHits: 1,
        baseAudioAssetMisses: 0,
        followUpCacheHits: 0,
        followUpCacheMisses: 0,
        examinerProfileId: 'british'
      })
    );
    expect(result.runtime).toEqual(
      expect.objectContaining({
        state: 'intro-examiner',
        retryCount: 0,
        currentPart: 0,
        currentTurnIndex: 0,
        currentSegment: expect.objectContaining({
          kind: 'cached_phrase',
          phraseId: 'welcome_intro'
        })
      })
    );

    expect(mockSimulationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          state: 'intro-examiner',
          retryCount: 0,
          currentSegment: expect.objectContaining({
            kind: 'cached_phrase',
            phraseId: 'welcome_intro'
          })
        }),
        sessionPackage: expect.objectContaining({
          prepareStatus: 'ready',
          requiredSegmentCount: 1,
          readySegmentCount: 1,
          examinerProfile: expect.objectContaining({
            id: 'british',
            accent: 'British',
            provider: 'openai'
          }),
          segments: expect.arrayContaining([
            expect.objectContaining({
              segmentId: 'fixed:welcome_intro',
              part: 0,
              turnType: 'examiner',
              canAutoAdvance: true,
              audioAssetId: 'asset-welcome',
              audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
              isReady: true,
              requiresGeneration: false
            })
          ])
        })
      })
    );
    expect(sessionPackageService.buildSessionPackage).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ part: 1 }),
        expect.objectContaining({ part: 2 }),
        expect.objectContaining({ part: 3 })
      ]),
      expect.objectContaining({
        selectionSeed: 'user-1:test-urc'
      })
    );
  });

  it('advances intro and part one into the learner answer state', async () => {
    const service = createService();

    await service.startSimulation('user-1', { urc: 'test-urc' } as any);

    const introCandidateTurn = await service.advanceRuntime(
      'user-1',
      'simulation-1',
      { urc: 'advance-1' } as any
    );
    expect(introCandidateTurn.runtime.state).toBe('intro-candidate-turn');

    const idCheck = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'My name is Mohammed Osman.', durationSeconds: 3 },
      { urc: 'answer-1' } as any
    );
    expect(idCheck.runtime.currentSegment.phraseId).toBe('id_check');

    const part1Begin = await service.advanceRuntime(
      'user-1',
      'simulation-1',
      { urc: 'advance-2' } as any
    );
    expect(part1Begin.runtime.currentSegment.phraseId).toBe('part1_begin');

    const firstQuestion = await service.advanceRuntime(
      'user-1',
      'simulation-1',
      { urc: 'advance-3' } as any
    );
    expect(firstQuestion.runtime.state).toBe('part1-examiner');
    expect(firstQuestion.runtime.currentPart).toBe(1);
    expect(firstQuestion.runtime.currentSegment.text).toContain(
      'Do you live in a house or an apartment?'
    );

    const learnerTurn = await service.advanceRuntime(
      'user-1',
      'simulation-1',
      { urc: 'advance-4' } as any
    );
    expect(learnerTurn.runtime.state).toBe('part1-candidate-turn');
  });

  it('generates a follow-up after a learner answer in part one', async () => {
    const service = createService();
    await startThroughFirstPart1CandidateTurn(service);

    const followUp = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live in an apartment near the city centre.', durationSeconds: 9 },
      { urc: 'answer-2' } as any
    );

    expect(followUp.runtime.state).toBe('part1-examiner');
    expect(followUp.runtime.currentSegment.text).toBe(
      'Could you tell me a little more about that?'
    );
    expect(followUp.sessionPackage?.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dynamic_follow_up',
          part: 1,
          turnType: 'examiner',
          text: 'Could you tell me a little more about that?',
          audioAssetId: 'asset-follow-up',
          audioUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up.mp3'
        })
      ])
    );
    expect((followUp as any).telemetry).toEqual(
      expect.objectContaining({
        examinerProfileId: 'british',
        followUpCacheHits: 0,
        followUpCacheMisses: 1
      })
    );
    expect(speechService.generateBufferedExaminerFollowUp).toHaveBeenCalledWith(
      expect.any(Array),
      1,
      expect.objectContaining({
        seedPrompt: 'Do you live in a house or an apartment?',
        followUpMode: 'single_narrow',
        voiceProfileId: 'british'
      })
    );
  });

  it('tracks adaptive follow-up cache hits in telemetry', async () => {
    speechService.generateBufferedExaminerFollowUp.mockResolvedValueOnce({
      text: 'Could you tell me a little more about that?',
      audioAssetId: 'asset-follow-up',
      audioUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up.mp3',
      cacheKey: 'dynamic-follow-up:british:could-you-tell-me-a-little-more-about-that',
      provider: 'openai',
      cacheHit: true
    });

    const service = createService();
    await startThroughFirstPart1CandidateTurn(service);

    const followUp = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live in an apartment near the city centre.', durationSeconds: 9 },
      { urc: 'answer-cache-hit' } as any
    );

    expect((followUp as any).telemetry).toEqual(
      expect.objectContaining({
        examinerProfileId: 'british',
        followUpCacheHits: 1,
        followUpCacheMisses: 0
      })
    );
  });

  it('returns the next visible turn before a deferred transcript is attached', async () => {
    const service = createService();
    await startThroughFirstPart1CandidateTurn(service);

    const nextTurn = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { durationSeconds: 9, deferTranscript: true } as any,
      { urc: 'answer-deferred' } as any
    );

    expect(nextTurn.runtime.state).toBe('part1-examiner');
    expect(nextTurn.runtime.currentSegment.text).toContain('What do you like most about your home?');
    expect(nextTurn.runtime.turnHistory?.at(-1)).toEqual(
      expect.objectContaining({
        part: 1,
        prompt: 'Do you live in a house or an apartment?',
        transcript: undefined,
        durationSeconds: 9
      })
    );

    const attached = await (service as any).attachRuntimeTranscript(
      'user-1',
      'simulation-1',
      {
        transcript: 'I live in a flat near the city centre.',
        durationSeconds: 9
      },
      { urc: 'answer-attach' } as any
    );

    expect(attached.runtime.state).toBe('part1-examiner');
    expect(attached.runtime.currentSegment.text).toContain('What do you like most about your home?');
    expect(attached.runtime.turnHistory?.at(-1)).toEqual(
      expect.objectContaining({
        part: 1,
        prompt: 'Do you live in a house or an apartment?',
        transcript: 'I live in a flat near the city centre.',
        durationSeconds: 9
      })
    );
  });

  it('marks the base session package as ready only when all required base segments are ready', async () => {
    const preparingPackage = {
      version: 1,
      preparedAt: new Date('2026-03-07T00:00:00.000Z'),
      prepareStatus: 'preparing',
      requiredSegmentCount: 3,
      readySegmentCount: 2,
      examinerProfile: {
        id: 'british',
        label: 'British Examiner',
        accent: 'British',
        provider: 'openai',
        voiceId: 'alloy',
        autoAssigned: true
      },
      segments: [
        {
          segmentId: 'fixed:welcome_intro',
          part: 0,
          phase: 'check-in',
          kind: 'fixed_phrase',
          turnType: 'examiner',
          canAutoAdvance: true,
          phraseId: 'welcome_intro',
          text: 'Good morning.',
          audioAssetId: 'asset-welcome',
          audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
          cacheKey: 'fixed:british:welcome_intro',
          provider: 'openai',
          isReady: true,
          requiresGeneration: false
        },
        {
          segmentId: 'fixed:id_check',
          part: 0,
          phase: 'check-in',
          kind: 'fixed_phrase',
          turnType: 'examiner',
          canAutoAdvance: true,
          phraseId: 'id_check',
          text: 'Could you please show me your identification document?',
          audioAssetId: 'asset-id-check',
          audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/id_check.mp3',
          cacheKey: 'fixed:british:id_check',
          provider: 'openai',
          isReady: true,
          requiresGeneration: false
        },
        {
          segmentId: 'part1:home-life:question-0',
          part: 1,
          phase: 'question-seed',
          kind: 'seed_prompt',
          turnType: 'examiner',
          canAutoAdvance: true,
          promptIndex: 0,
          text: 'Do you live in a house or an apartment?',
          audioAssetId: 'part1-home-life-question-0',
          audioUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/home-life/question-0.mp3',
          cacheKey: 'question:british:part1:home-life:0',
          provider: 'openai',
          isReady: false,
          requiresGeneration: true
        }
      ]
    };
    sessionPackageService.buildSessionPackage.mockResolvedValueOnce(preparingPackage);
    sessionPackageService.ensurePackageReady.mockResolvedValueOnce({
      ...preparingPackage,
      prepareStatus: 'ready',
      readySegmentCount: 3,
      segments: preparingPackage.segments.map((segment: any) => ({
        ...segment,
        isReady: true,
        requiresGeneration: false
      }))
    });

    const service = createService();
    const result = await service.startSimulation('user-1', { urc: 'test-urc' } as any);

    expect(result.sessionPackage).toEqual(
      expect.objectContaining({
        prepareStatus: 'ready',
        requiredSegmentCount: 3,
        readySegmentCount: 3,
        segments: expect.arrayContaining([
          expect.objectContaining({
            segmentId: 'part1:home-life:question-0',
            isReady: true,
            requiresGeneration: false
          })
        ])
      })
    );
    expect(sessionPackageService.ensurePackageReady).toHaveBeenCalledWith(
      preparingPackage,
      expect.objectContaining({
        simulationParts: expect.arrayContaining([
          expect.objectContaining({ part: 1 }),
          expect.objectContaining({ part: 2 }),
          expect.objectContaining({ part: 3 })
        ])
      })
    );
  });

  it('pauses on the first examiner generation failure and terminally fails on the second', async () => {
    speechService.generateBufferedExaminerFollowUp.mockRejectedValue(new Error('examiner generation failed'));

    const service = createService();
    await startThroughFirstPart1CandidateTurn(service);

    const firstFailure = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live in an apartment near the city centre.', durationSeconds: 9 },
      { urc: 'answer-2' } as any
    );

    expect(firstFailure.runtime.state).toBe('paused-retryable');
    expect(firstFailure.runtime.retryCount).toBe(1);

    const retried = await service.retryRuntimeStep(
      'user-1',
      'simulation-1',
      { urc: 'retry-1' } as any
    );
    expect(retried.runtime.state).toBe('part1-candidate-turn');
    expect(retried.runtime.retryCount).toBe(0);

    const secondFailure = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live in an apartment near the city centre.', durationSeconds: 9 },
      { urc: 'answer-3' } as any
    );
    expect(secondFailure.runtime.state).toBe('failed-terminal');
  });

  it('limits part one to five examiner prompts before auto-transitioning to part two', async () => {
    const service = createService();
    await startThroughFirstPart1CandidateTurn(service);

    const followUp = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live in an apartment near the city centre.', durationSeconds: 9 },
      { urc: 'answer-p1-1' } as any
    );
    expect(followUp.runtime.state).toBe('part1-examiner');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-p1-5' } as any);
    const secondSeed = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'It is close to my work and very quiet.', durationSeconds: 8 },
      { urc: 'answer-p1-2' } as any
    );
    expect(secondSeed.runtime.currentSegment.text).toBe('What do you like most about your home?');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-p1-6' } as any);
    const thirdSeed = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I enjoy the calm atmosphere and the view.', durationSeconds: 7 },
      { urc: 'answer-p1-3' } as any
    );
    expect(thirdSeed.runtime.currentSegment.text).toBe('Who do you live with?');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-p1-7' } as any);
    const fourthSeed = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live with my wife and our daughter.', durationSeconds: 7 },
      { urc: 'answer-p1-4' } as any
    );
    expect(fourthSeed.runtime.currentSegment.text).toBe('Is your neighbourhood a good place for families?');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-p1-8' } as any);
    const transition = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'Yes, it is safe and there are many parks nearby.', durationSeconds: 7 },
      { urc: 'answer-p1-5' } as any
    );

    expect(transition.runtime.state).toBe('part1-transition');
    expect(speechService.generateBufferedExaminerFollowUp).toHaveBeenCalledTimes(1);
  });

  it('limits part three to four examiner prompts before auto-transitioning to evaluation', async () => {
    const service = createService();
    await startThroughFirstPart1CandidateTurn(service);

    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live in an apartment near the city centre.', durationSeconds: 9 },
      { urc: 'answer-seed-1' } as any
    );
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-seed-followup' } as any);
    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'It has a great location and I enjoy the quiet streets.', durationSeconds: 8 },
      { urc: 'answer-seed-followup' } as any
    );
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-seed-2' } as any);
    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I like the light and the small balcony the most.', durationSeconds: 7 },
      { urc: 'answer-seed-2' } as any
    );
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-seed-3' } as any);
    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'I live with my family.', durationSeconds: 6 },
      { urc: 'answer-seed-3' } as any
    );
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-seed-4' } as any);
    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'Yes, there are schools, shops, and parks nearby.', durationSeconds: 8 },
      { urc: 'answer-seed-4' } as any
    );

    const part2Intro = await service.advanceRuntime(
      'user-1',
      'simulation-1',
      { urc: 'advance-part2-intro' } as any
    );
    expect(part2Intro.runtime.state).toBe('part2-intro');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part2-prep' } as any);
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part2-launch' } as any);
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part2-candidate' } as any);
    speechService.generateBufferedExaminerFollowUp.mockClear();

    await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      {
        transcript: 'I would like to talk about a memorable journey I took with my family to Istanbul.',
        durationSeconds: 70
      },
      { urc: 'answer-part2' } as any
    );
    expect(speechService.generateBufferedExaminerFollowUp).not.toHaveBeenCalled();
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part3-intro' } as any);
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part3-first-question' } as any);
    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part3-candidate-turn' } as any);

    speechService.generateBufferedExaminerFollowUp.mockClear();

    const part3FollowUp = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'Tourism has become cheaper and more global because of online booking.', durationSeconds: 11 },
      { urc: 'answer-part3-1' } as any
    );
    expect(part3FollowUp.runtime.state).toBe('part3-examiner');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part3-followup' } as any);
    const part3SecondSeed = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'Mass tourism can damage the environment and increase prices for locals.', durationSeconds: 10 },
      { urc: 'answer-part3-2' } as any
    );
    expect(part3SecondSeed.runtime.currentSegment.text).toBe('What are the disadvantages of mass tourism?');

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part3-seed-2' } as any);
    const part3ThirdSeed = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'It can also make popular places overcrowded.', durationSeconds: 7 },
      { urc: 'answer-part3-3' } as any
    );
    expect(part3ThirdSeed.runtime.currentSegment.text).toBe(
      'How can governments support local communities affected by tourism?'
    );

    await service.advanceRuntime('user-1', 'simulation-1', { urc: 'advance-part3-seed-3' } as any);
    const evaluation = await service.submitRuntimeAnswer(
      'user-1',
      'simulation-1',
      { transcript: 'They can invest in infrastructure and protect local businesses.', durationSeconds: 8 },
      { urc: 'answer-part3-4' } as any
    );

    expect(evaluation.runtime.state).toBe('evaluation');
    expect(speechService.generateBufferedExaminerFollowUp).toHaveBeenCalledTimes(1);
    expect(speechService.generateBufferedExaminerFollowUp).toHaveBeenCalledWith(
      expect.any(Array),
      3,
      expect.objectContaining({
        seedPrompt: 'How has tourism changed in recent years?',
        followUpMode: 'single_narrow',
        voiceProfileId: 'british'
      })
    );
  });
});
