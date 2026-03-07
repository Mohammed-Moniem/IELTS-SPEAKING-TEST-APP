import { SpeakingExaminerProfileService } from '@services/SpeakingExaminerProfileService';

describe('SpeakingExaminerProfileService', () => {
  it('selects the same auto profile for the same seed', () => {
    const service = new SpeakingExaminerProfileService();
    const first = service.resolveProfile('auto', 'user-1:test-urc');
    const second = service.resolveProfile('auto', 'user-1:test-urc');

    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.objectContaining({
        provider: 'openai',
        autoAssigned: true
      })
    );
  });

  it('rotates auto profile selection across multiple seeds', () => {
    const service = new SpeakingExaminerProfileService();
    const selectedProfileIds = new Set(
      ['user-1:test-urc', 'user-1:test-urc-2', 'user-2:test-urc', 'user-3:test-urc'].map(seed =>
        service.resolveProfile('auto', seed).id
      )
    );

    expect(selectedProfileIds.size).toBeGreaterThan(1);
  });

  it('lists the launch and expansion examiner profiles', () => {
    const service = new SpeakingExaminerProfileService();

    expect(service.listProfiles().map(profile => profile.id)).toEqual(
      expect.arrayContaining(['british', 'australian', 'north-american', 'canadian', 'indian'])
    );
  });
});
