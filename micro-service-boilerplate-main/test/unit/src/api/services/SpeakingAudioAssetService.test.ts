const mockSpeakingAudioAssetFindOne = jest.fn();

jest.mock('@models/SpeakingAudioAssetModel', () => ({
  SpeakingAudioAssetModel: {
    findOne: mockSpeakingAudioAssetFindOne
  }
}));

import { SpeakingAudioAssetService } from '@services/SpeakingAudioAssetService';

describe('SpeakingAudioAssetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('looks up fixed phrase assets by normalized cache key', async () => {
    mockSpeakingAudioAssetFindOne.mockResolvedValue({
      cacheKey: 'fixed:british:welcome_intro',
      publicUrl: 'https://storage.spokio.local/speaking/fixed/british/welcome_intro.mp3'
    });

    const service = new SpeakingAudioAssetService();
    const asset = await service.getFixedPhraseAsset('british', 'welcome_intro');

    expect(mockSpeakingAudioAssetFindOne).toHaveBeenCalledWith({
      cacheKey: 'fixed:british:welcome_intro'
    });
    expect(asset?.publicUrl).toContain('/speaking/fixed/british/welcome_intro.mp3');
  });

  it('looks up question assets by normalized cache key', async () => {
    mockSpeakingAudioAssetFindOne.mockResolvedValue({
      cacheKey: 'question:british:part1:transport:0:where-do-you-usually-study-transport',
      publicUrl: 'https://storage.spokio.local/speaking/questions/british/part1/transport/0.mp3'
    });

    const service = new SpeakingAudioAssetService();
    const asset = await service.getQuestionAsset({
      voiceProfileId: 'british',
      part: 1,
      topicId: 'transport',
      promptIndex: 0,
      text: '  Where do you usually study transport?  '
    });

    expect(mockSpeakingAudioAssetFindOne).toHaveBeenCalledWith({
      cacheKey: 'question:british:part1:transport:0:where-do-you-usually-study-transport'
    });
    expect(asset?.publicUrl).toContain('/speaking/questions/british/part1/transport/0.mp3');
  });
});
