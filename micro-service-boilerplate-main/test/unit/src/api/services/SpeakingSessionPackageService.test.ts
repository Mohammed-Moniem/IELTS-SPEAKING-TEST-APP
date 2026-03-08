const mockAssetFindOne = jest.fn();

jest.mock('@models/SpeakingAudioAssetModel', () => ({
  SpeakingAudioAssetModel: {
    findOne: mockAssetFindOne,
  },
}));

import { SpeakingSessionPackageService } from '@services/SpeakingSessionPackageService';
import { SpeakingAudioAssetService } from '@services/SpeakingAudioAssetService';

describe('SpeakingSessionPackageService', () => {
  const buildStubAudioAssetService = () => {
    const audioAssetService = new SpeakingAudioAssetService();

    return {
      buildFixedPhraseCacheKey: audioAssetService.buildFixedPhraseCacheKey.bind(audioAssetService),
      buildQuestionCacheKey: audioAssetService.buildQuestionCacheKey.bind(audioAssetService),
      normalizeText: audioAssetService.normalizeText.bind(audioAssetService),
      getFixedPhraseAsset: audioAssetService.getFixedPhraseAsset.bind(audioAssetService),
      getQuestionAsset: audioAssetService.getQuestionAsset.bind(audioAssetService),
      storeBaseSegmentAsset: jest.fn().mockImplementation(async ({ cacheKey, storagePath, provider }: any) => ({
        _id: `stored-${cacheKey}`,
        publicUrl: `https://cdn.spokio.com/${storagePath}`,
        provider,
        durationSeconds: 4
      }))
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAssetFindOne.mockImplementation(async ({ cacheKey }: { cacheKey: string }) => {
      if (cacheKey === 'fixed:british:welcome_intro') {
        return {
          _id: 'asset-welcome',
          publicUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
          durationSeconds: 6,
        };
      }

      if (cacheKey === 'question:british:part1:home-life:0:do-you-live-in-a-house-or-an-apartment') {
        return {
          _id: 'asset-part1-q1',
          publicUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/home-life/q1.mp3',
          durationSeconds: 4,
        };
      }

      return null;
    });
  });

  it('builds a preloaded session package with resolved assets and bounded seed prompts', async () => {
    const audioAssetService = buildStubAudioAssetService();

    const service = new SpeakingSessionPackageService(
      undefined,
      undefined,
      audioAssetService as any,
      {
        synthesize: jest.fn().mockResolvedValue({
          buffer: Buffer.from('mock-audio'),
          cacheHit: false,
          voiceId: 'openai:alloy',
          cacheExpiresAt: null,
        }),
      } as any
    );

    const sessionPackage = await service.buildSessionPackage([
      {
        part: 1,
        topicId: 'home-life',
        topicTitle: 'Home life',
        question: [
          'Do you live in a house or an apartment?',
          'What do you like most about your home?',
          'Who do you live with?',
          'Is your neighbourhood a good place for families?',
          'Would you like to move in the future?',
        ].join('\n'),
        timeLimit: 240,
        tips: [],
      },
      {
        part: 2,
        topicId: 'travel',
        topicTitle: 'Travel',
        question: 'Describe a memorable journey you have taken.\n\nYou should say:\n• where you went\n• who you were with',
        timeLimit: 180,
        tips: [],
      },
      {
        part: 3,
        topicId: 'travel',
        topicTitle: 'Travel',
        question: [
          'How has tourism changed in recent years?',
          'What are the disadvantages of mass tourism?',
          'How can governments support local communities affected by tourism?',
          'Should tourism be limited in popular places?',
        ].join('\n'),
        timeLimit: 240,
        tips: [],
      },
    ]);

    expect(sessionPackage.examinerProfile).toEqual(
      expect.objectContaining({
        id: 'british',
        provider: 'openai',
        autoAssigned: true,
      })
    );

    expect(sessionPackage.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          segmentId: 'fixed:welcome_intro',
          audioAssetId: 'asset-welcome',
          audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
          durationSeconds: 6,
        }),
        expect.objectContaining({
          segmentId: 'part1:home-life:question-0',
          audioAssetId: 'asset-part1-q1',
          audioUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/home-life/q1.mp3',
        }),
        expect.objectContaining({
          segmentId: 'part2:travel:cue-card',
          kind: 'cue_card',
          audioUrl: expect.stringContaining('/part2/travel/cue-card.mp3'),
        }),
      ])
    );

    expect(
      sessionPackage.segments.filter(segment => segment.part === 1 && segment.kind === 'seed_prompt')
    ).toHaveLength(4);
    expect(
      sessionPackage.segments.filter(segment => segment.part === 3 && segment.kind === 'seed_prompt')
    ).toHaveLength(3);
  });

  it('prebuilds missing base examiner audio before returning package segments', async () => {
    const audioAssetService = buildStubAudioAssetService();
    const synthesize = jest.fn().mockResolvedValue({
      buffer: Buffer.from('mock-audio'),
      cacheHit: false,
      voiceId: 'openai:alloy',
      cacheExpiresAt: null
    });

    mockAssetFindOne.mockResolvedValue(null);

    const service = new SpeakingSessionPackageService(
      undefined,
      undefined,
      audioAssetService as any,
      {
        synthesize
      } as any
    );

    const sessionPackage = await service.buildSessionPackage([
      {
        part: 1,
        topicId: 'weather',
        topicTitle: 'Weather',
        question: 'What kind of weather do you enjoy most?\nHow does the weather change during the year where you live?',
        timeLimit: 240,
        tips: []
      },
      {
        part: 2,
        topicId: 'workshop',
        topicTitle: 'Workshop',
        question: 'Describe a challenging workshop you attended.\n\nYou should say:\n• what it was about\n• why it was challenging',
        timeLimit: 180,
        tips: []
      }
    ]);

    expect(synthesize).toHaveBeenCalled();
    expect(audioAssetService.storeBaseSegmentAsset).toHaveBeenCalled();

    const requiredSegments = sessionPackage.segments.filter(segment => segment.kind !== 'dynamic_follow_up');
    expect(requiredSegments.every(segment => segment.isReady)).toBe(true);
    expect(requiredSegments.every(segment => !segment.requiresGeneration)).toBe(true);
    expect(requiredSegments.every(segment => segment.audioUrl.startsWith('https://cdn.spokio.com/'))).toBe(true);
  });
});
