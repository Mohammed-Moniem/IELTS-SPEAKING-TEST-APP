/**
 * Test History Model
 * Tracks all test attempts with detailed scoring and progress
 */

export enum TestType {
  PRACTICE = 'practice',
  SIMULATION = 'simulation'
}

export interface CriteriaScore {
  band: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface TestHistory {
  _id?: string;
  userId: string;
  sessionId: string;
  testType: TestType;

  // Test details
  topic: string;
  testPart?: string; // 'part1', 'part2', 'part3'
  durationSeconds: number;
  completedAt: Date;

  // Scoring
  overallBand: number;
  criteria: {
    fluencyCoherence: CriteriaScore;
    lexicalResource: CriteriaScore;
    grammaticalRange: CriteriaScore;
    pronunciation: CriteriaScore;
  };

  // Detailed feedback
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  suggestions?: string[];

  // Audio reference
  audioRecordingId?: string;

  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class TestHistoryModel {
  static collectionName = 'test_history';

  /**
   * Create test history document
   */
  static create(data: Partial<TestHistory>): TestHistory {
    return {
      userId: data.userId!,
      sessionId: data.sessionId!,
      testType: data.testType || TestType.PRACTICE,
      topic: data.topic!,
      testPart: data.testPart,
      durationSeconds: data.durationSeconds || 0,
      completedAt: data.completedAt || new Date(),
      overallBand: data.overallBand!,
      criteria: data.criteria!,
      corrections: data.corrections || [],
      suggestions: data.suggestions || [],
      audioRecordingId: data.audioRecordingId,
      metadata: data.metadata || {},
      createdAt: data.createdAt || new Date()
    };
  }

  /**
   * Calculate average band score from criteria
   */
  static calculateAverageBand(criteria: TestHistory['criteria']): number {
    const bands = [
      criteria.fluencyCoherence.band,
      criteria.lexicalResource.band,
      criteria.grammaticalRange.band,
      criteria.pronunciation.band
    ];

    const sum = bands.reduce((acc, band) => acc + band, 0);
    const average = sum / bands.length;

    // Round to nearest 0.5
    return Math.round(average * 2) / 2;
  }

  /**
   * Get band label
   */
  static getBandLabel(band: number): string {
    if (band >= 8.5) return 'Expert User';
    if (band >= 8) return 'Very Good User';
    if (band >= 7) return 'Good User';
    if (band >= 6.5) return 'Competent User';
    if (band >= 6) return 'Competent User';
    if (band >= 5.5) return 'Modest User';
    if (band >= 5) return 'Modest User';
    return 'Limited User';
  }

  /**
   * Categorize strengths and weaknesses
   */
  static analyzePerformance(criteria: TestHistory['criteria']): {
    strengths: string[];
    weaknesses: string[];
  } {
    const criteriaArray = [
      { name: 'Fluency & Coherence', score: criteria.fluencyCoherence.band },
      { name: 'Lexical Resource', score: criteria.lexicalResource.band },
      { name: 'Grammatical Range', score: criteria.grammaticalRange.band },
      { name: 'Pronunciation', score: criteria.pronunciation.band }
    ];

    // Sort by score
    criteriaArray.sort((a, b) => b.score - a.score);

    const strengths = criteriaArray.slice(0, 2).map(c => c.name);
    const weaknesses = criteriaArray.slice(2, 4).map(c => c.name);

    return { strengths, weaknesses };
  }
}
