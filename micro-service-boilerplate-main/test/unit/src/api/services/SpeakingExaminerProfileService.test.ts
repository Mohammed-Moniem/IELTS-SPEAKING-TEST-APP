import { SpeakingExaminerProfileService } from '@services/SpeakingExaminerProfileService';

describe('SpeakingExaminerProfileService', () => {
  it('selects the default auto profile deterministically', () => {
    const service = new SpeakingExaminerProfileService();

    expect(service.resolveProfile('auto')).toEqual(
      expect.objectContaining({
        id: 'british',
        accent: 'British',
        provider: 'openai',
        autoAssigned: true
      })
    );
  });

  it('lists the launch examiner profiles', () => {
    const service = new SpeakingExaminerProfileService();

    expect(service.listProfiles().map(profile => profile.id)).toEqual(
      expect.arrayContaining(['british', 'australian', 'north-american'])
    );
  });
});
