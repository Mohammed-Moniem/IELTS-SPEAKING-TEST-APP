import { Service } from 'typedi';

export type ExaminerPhraseId =
  | 'welcome_intro'
  | 'id_check'
  | 'part1_begin'
  | 'part1_transition'
  | 'part2_intro'
  | 'part2_begin_speaking'
  | 'part2_transition'
  | 'part3_intro'
  | 'test_complete';

export interface ExaminerPhrase {
  id: ExaminerPhraseId;
  text: string;
  cacheable: boolean;
}

const EXAMINER_PHRASES: Record<ExaminerPhraseId, ExaminerPhrase> = {
  welcome_intro: {
    id: 'welcome_intro',
    text: 'Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?',
    cacheable: true
  },
  id_check: {
    id: 'id_check',
    text: 'Thank you. Could you please show me your identification document?',
    cacheable: true
  },
  part1_begin: {
    id: 'part1_begin',
    text: "Thank you. Let's begin with Part 1 of the test.",
    cacheable: true
  },
  part1_transition: {
    id: 'part1_transition',
    text: "Thank you. That's the end of Part 1. Now let's move on to Part 2.",
    cacheable: true
  },
  part2_intro: {
    id: 'part2_intro',
    text: "Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say.",
    cacheable: true
  },
  part2_begin_speaking: {
    id: 'part2_begin_speaking',
    text: 'Please begin speaking now.',
    cacheable: true
  },
  part2_transition: {
    id: 'part2_transition',
    text: "Thank you. That's the end of Part 2.",
    cacheable: true
  },
  part3_intro: {
    id: 'part3_intro',
    text: "Thank you. Now we'll move on to Part 3, where I'll ask you some more abstract questions.",
    cacheable: true
  },
  test_complete: {
    id: 'test_complete',
    text: "Thank you for your responses. That's the end of the speaking test. Please allow me a moment to evaluate your progress.",
    cacheable: true
  }
};

@Service()
export class ExaminerPhraseService {
  public getPhrase(id: ExaminerPhraseId): ExaminerPhrase {
    const phrase = EXAMINER_PHRASES[id];
    if (!phrase) {
      throw new Error(`Unknown examiner phrase: ${id}`);
    }
    return phrase;
  }

  public listCacheablePhrases(): ExaminerPhrase[] {
    return Object.values(EXAMINER_PHRASES).filter(phrase => phrase.cacheable);
  }

  public buildAudioCacheKey(voiceProfileId: string, phraseId: ExaminerPhraseId) {
    return `fixed:${voiceProfileId}:${phraseId}`;
  }
}
