import { ExaminerPhraseService } from '@services/ExaminerPhraseService';
import { SpeakingAudioAssetService } from '@services/SpeakingAudioAssetService';
import { SpeakingExaminerProfileService } from '@services/SpeakingExaminerProfileService';
import { buildSpeakingPromptManifest, composeCueCardNarrationText } from '../../../../../scripts/speaking-gen/export-prompts';

describe('speaking-gen export prompts', () => {
  const phraseService = new ExaminerPhraseService();
  const profileService = new SpeakingExaminerProfileService();
  const assetService = new SpeakingAudioAssetService();

  it('exports fixed phrases and bank prompts with normalized cache keys', () => {
    const voiceProfiles = profileService.listProfiles().slice(0, 2);
    const fixedPhrases = phraseService.listCacheablePhrases();
    const bankQuestions = [
      {
        _id: 'part1-weather',
        category: 'part1' as const,
        topic: 'Weather',
        question: 'What weather do you like most?',
        cueCard: undefined
      },
      {
        _id: 'part2-research',
        category: 'part2' as const,
        topic: 'Research',
        question: 'Describe a rewarding research project.',
        cueCard: {
          bulletPoints: ['What the project was', 'Why it was rewarding'],
          preparationTime: 60,
          timeToSpeak: 120
        }
      },
      {
        _id: 'part3-technology',
        category: 'part3' as const,
        topic: 'Technology',
        question: 'How has technology changed education?',
        cueCard: undefined
      }
    ];

    const manifest = buildSpeakingPromptManifest({
      voiceProfiles,
      fixedPhrases,
      bankQuestions,
      assetService
    });

    expect(manifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'fixed_phrase',
          cacheKey: phraseService.buildAudioCacheKey('british', 'welcome_intro'),
          voiceProfileId: 'british',
          part: 0
        }),
        expect.objectContaining({
          kind: 'bank_question',
          category: 'part1',
          cacheKey: assetService.buildQuestionCacheKey({
            voiceProfileId: 'australian',
            part: 1,
            topicId: 'weather',
            promptIndex: 0,
            text: 'What weather do you like most?'
          }),
          voiceProfileId: 'australian',
          questionId: 'part1-weather',
          part: 1
        }),
        expect.objectContaining({
          kind: 'cue_card',
          category: 'part2',
          voiceProfileId: 'british',
          questionId: 'part2-research',
          part: 2,
          text: composeCueCardNarrationText(bankQuestions[1] as any)
        }),
        expect.objectContaining({
          kind: 'bank_question',
          category: 'part3',
          cacheKey: assetService.buildQuestionCacheKey({
            voiceProfileId: 'british',
            part: 3,
            topicId: 'technology',
            promptIndex: 0,
            text: 'How has technology changed education?'
          }),
          part: 3
        })
      ])
    );
  });
});
