import { ICriteriaScore, ICorrection, ISuggestion } from '@models/TestEvaluationModel';

export interface EvaluationCriteriaPayload {
  fluencyCoherence: ICriteriaScore;
  lexicalResource: ICriteriaScore;
  grammaticalRange: ICriteriaScore;
  pronunciation: ICriteriaScore;
}

export interface FullTestEvaluationQuestion {
  questionId?: string;
  question: string;
  category: 'part1' | 'part2' | 'part3';
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface FullTestEvaluationResponse {
  transcript: string;
  questionIndex: number;
  durationSeconds?: number;
  recordingUrl?: string;
}

export interface FullTestEvaluationPart {
  partNumber: 1 | 2 | 3;
  questions: FullTestEvaluationQuestion[];
  responses: FullTestEvaluationResponse[];
}

export interface FullTestEvaluationMetadata {
  candidateName?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  testStartedAt?: string;
  testCompletedAt?: string;
}

export interface FullTestEvaluationPayload {
  userId: string;
  fullTranscript: string;
  durationSeconds?: number;
  parts: FullTestEvaluationPart[];
  metadata?: FullTestEvaluationMetadata;
}

export interface FullTestEvaluationResult {
  overallBand: number;
  spokenSummary: string;
  detailedFeedback: string;
  criteria: EvaluationCriteriaPayload;
  corrections: ICorrection[];
  suggestions: ISuggestion[];
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
  evaluatorModel?: string;
}
