import { Service } from 'typedi';

import { env } from '../../env';

export interface SpeakingExaminerProfile {
  id: string;
  label: string;
  accent: string;
  provider: 'openai' | 'elevenlabs' | 'edge-tts';
  voiceId: string;
  autoAssigned: boolean;
}

const EXAMINER_PROFILES: SpeakingExaminerProfile[] = [
  {
    id: 'british',
    label: 'British Examiner',
    accent: 'British',
    provider: 'openai',
    voiceId: 'alloy',
    autoAssigned: true
  },
  {
    id: 'australian',
    label: 'Australian Examiner',
    accent: 'Australian',
    provider: 'openai',
    voiceId: 'echo',
    autoAssigned: true
  },
  {
    id: 'north-american',
    label: 'North American Examiner',
    accent: 'North American',
    provider: 'openai',
    voiceId: 'verse',
    autoAssigned: true
  }
];

@Service()
export class SpeakingExaminerProfileService {
  public listProfiles(): SpeakingExaminerProfile[] {
    return EXAMINER_PROFILES;
  }

  public resolveProfile(requestedProfile?: string): SpeakingExaminerProfile {
    const normalized = (requestedProfile || env.speaking.defaultExaminerProfile || 'auto').trim().toLowerCase();

    if (normalized === 'auto') {
      return EXAMINER_PROFILES[0];
    }

    return EXAMINER_PROFILES.find(profile => profile.id === normalized) || EXAMINER_PROFILES[0];
  }
}
