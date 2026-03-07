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
  },
  {
    id: 'canadian',
    label: 'Canadian Examiner',
    accent: 'Canadian',
    provider: 'openai',
    voiceId: 'sage',
    autoAssigned: true
  },
  {
    id: 'indian',
    label: 'Indian English Examiner',
    accent: 'Indian English',
    provider: 'openai',
    voiceId: 'ash',
    autoAssigned: true
  }
];

@Service()
export class SpeakingExaminerProfileService {
  public listProfiles(): SpeakingExaminerProfile[] {
    return EXAMINER_PROFILES;
  }

  public resolveProfile(requestedProfile?: string, selectionSeed?: string): SpeakingExaminerProfile {
    const normalized = (requestedProfile || env.speaking.defaultExaminerProfile || 'auto').trim().toLowerCase();

    if (normalized === 'auto') {
      return this.resolveAutoProfile(selectionSeed);
    }

    return EXAMINER_PROFILES.find(profile => profile.id === normalized) || EXAMINER_PROFILES[0];
  }

  private resolveAutoProfile(selectionSeed?: string): SpeakingExaminerProfile {
    const autoProfiles = EXAMINER_PROFILES.filter(profile => profile.autoAssigned);

    if (!autoProfiles.length) {
      return EXAMINER_PROFILES[0];
    }

    if (!selectionSeed) {
      return autoProfiles[0];
    }

    const hash = Array.from(selectionSeed).reduce((total, character, index) => {
      return total + character.charCodeAt(0) * (index + 1);
    }, 0);

    return autoProfiles[hash % autoProfiles.length];
  }
}
