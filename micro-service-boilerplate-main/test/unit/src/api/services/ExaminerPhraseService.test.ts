import { ExaminerPhraseService } from '@services/ExaminerPhraseService';

describe('ExaminerPhraseService', () => {
  it('returns the fixed passport request phrase', () => {
    const service = new ExaminerPhraseService();

    expect(service.getPhrase('id_check')).toEqual(
      expect.objectContaining({
        id: 'id_check',
        cacheable: true,
        text: expect.stringContaining('identification document')
      })
    );
  });

  it('lists cacheable intro and transition phrases for preloading', () => {
    const service = new ExaminerPhraseService();

    const ids = service.listCacheablePhrases().map(item => item.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'welcome_intro',
        'id_check',
        'part1_transition',
        'part2_intro',
        'part3_intro',
        'test_complete'
      ])
    );
  });

  it('builds deterministic fixed-phrase cache keys by voice profile', () => {
    const service = new ExaminerPhraseService();

    expect(service.buildAudioCacheKey('british', 'welcome_intro')).toBe(
      'fixed:british:welcome_intro'
    );
  });
});
