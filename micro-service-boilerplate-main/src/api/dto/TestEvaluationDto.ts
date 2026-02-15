export interface FullTestEvaluationRecordingDto {
  partNumber: 1 | 2 | 3;
  questionIndex: number;
  transcript: string;
  durationSeconds: number;
  recordingUrl?: string;
  audioData?: string;
}

export interface FullTestEvaluationQuestionDto {
  questionId?: string;
  question: string;
  category: 'part1' | 'part2' | 'part3';
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
}

export interface FullTestEvaluationRequestDto {
  testSessionId?: string;
  fullTranscript?: string;
  durationSeconds: number;
  questions: FullTestEvaluationQuestionDto[];
  recordings: FullTestEvaluationRecordingDto[];
  metadata?: {
    candidateName?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    testStartedAt?: string;
    testCompletedAt?: string;
  };
}
