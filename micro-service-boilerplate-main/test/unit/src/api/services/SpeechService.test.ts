import { SpeechService } from '@services/SpeechService';

describe('SpeechService buffered examiner follow-up audio', () => {
  const audioAssetService = {
    buildDynamicFollowUpCacheKey: jest.fn(),
    getDynamicFollowUpAsset: jest.fn(),
    cacheDynamicFollowUpAsset: jest.fn()
  };
  const examinerProfileService = {
    resolveProfile: jest.fn()
  };

  const createService = () =>
    new SpeechService(
      audioAssetService as any,
      examinerProfileService as any,
      {} as any
    );

  beforeEach(() => {
    jest.clearAllMocks();

    examinerProfileService.resolveProfile.mockReturnValue({
      id: 'british',
      label: 'British Examiner',
      accent: 'British',
      provider: 'openai',
      voiceId: 'alloy',
      autoAssigned: true
    });
    audioAssetService.buildDynamicFollowUpCacheKey.mockReturnValue(
      'dynamic-follow-up:british:could-you-tell-me-a-little-more-about-that'
    );
  });

  it('reuses a cached follow-up asset for the same voice profile and normalized text', async () => {
    const service = createService();
    jest.spyOn(service, 'generateExaminerResponse').mockResolvedValue(
      'Could you tell me a little more about that?'
    );
    const synthesizeSpy = jest.spyOn(service, 'synthesize');

    audioAssetService.getDynamicFollowUpAsset.mockResolvedValue({
      _id: 'asset-cached',
      status: 'ready',
      provider: 'openai',
      publicUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up.mp3'
    });

    const result = await service.generateBufferedExaminerFollowUp(
      [{ role: 'user', content: 'I live in a city apartment.' }],
      1,
      {
        seedPrompt: 'Do you live in a house or an apartment?',
        followUpMode: 'single_narrow',
        voiceProfileId: 'british'
      }
    );

    expect(audioAssetService.buildDynamicFollowUpCacheKey).toHaveBeenCalledWith(
      'british',
      'Could you tell me a little more about that?'
    );
    expect(synthesizeSpy).not.toHaveBeenCalled();
    expect(audioAssetService.cacheDynamicFollowUpAsset).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        text: 'Could you tell me a little more about that?',
        audioAssetId: 'asset-cached',
        audioUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up.mp3',
        cacheKey: 'dynamic-follow-up:british:could-you-tell-me-a-little-more-about-that',
        cacheHit: true
      })
    );
  });

  it('synthesizes and caches follow-up audio when the asset is missing', async () => {
    const service = createService();
    jest.spyOn(service, 'generateExaminerResponse').mockResolvedValue(
      'Could you tell me a little more about that?'
    );
    const synthesizeSpy = jest.spyOn(service, 'synthesize').mockResolvedValue({
      buffer: Buffer.from('mp3-audio'),
      cacheHit: false,
      voiceId: 'openai:alloy',
      cacheExpiresAt: null
    });

    audioAssetService.getDynamicFollowUpAsset.mockResolvedValue(null);
    audioAssetService.cacheDynamicFollowUpAsset.mockResolvedValue({
      _id: 'asset-new',
      status: 'ready',
      provider: 'openai',
      durationSeconds: 4,
      publicUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up-new.mp3'
    });

    const result = await service.generateBufferedExaminerFollowUp(
      [{ role: 'user', content: 'It is close to work and very quiet.' }],
      3,
      {
        seedPrompt: 'How has tourism changed in recent years?',
        followUpMode: 'single_narrow',
        voiceProfileId: 'british'
      }
    );

    expect(synthesizeSpy).toHaveBeenCalledWith(
      'Could you tell me a little more about that?',
      expect.objectContaining({
        provider: 'openai',
        voiceId: 'alloy',
        cacheKey: 'dynamic-follow-up:british:could-you-tell-me-a-little-more-about-that'
      })
    );
    expect(audioAssetService.cacheDynamicFollowUpAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceProfileId: 'british',
        provider: 'openai',
        text: 'Could you tell me a little more about that?',
        audioBuffer: Buffer.from('mp3-audio'),
        mimeType: 'audio/mpeg'
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        text: 'Could you tell me a little more about that?',
        audioAssetId: 'asset-new',
        audioUrl: 'https://cdn.spokio.com/speaking/follow-ups/british/follow-up-new.mp3',
        cacheKey: 'dynamic-follow-up:british:could-you-tell-me-a-little-more-about-that',
        cacheHit: false
      })
    );
  });
});
