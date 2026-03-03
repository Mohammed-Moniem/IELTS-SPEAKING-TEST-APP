import 'reflect-metadata';

import { env } from '../../../../../src/env';
import { WritingService } from '../../../../../src/api/services/WritingService';

describe('WritingService deep feedback normalization', () => {
  const service = new WritingService({} as any, {} as any);

  it('builds v2 deep feedback payload with task-achievement label for task1', () => {
    const normalized = (service as any).normalizeEvaluationPayload(
      {},
      {
        wordCount: 210,
        taskType: 'task1',
        track: 'academic'
      }
    );

    expect(normalized.feedbackVersion).toBe('v2');
    expect(normalized.deepFeedbackReady).toBe(true);
    expect(normalized.feedback.overall).toBeDefined();
    expect(normalized.feedback.criteria).toBeDefined();
    expect(normalized.feedback.criteria.taskAchievementOrResponse.descriptorSummary).toMatch(/Task Achievement/i);
  });

  it('derives legacy inline suggestions from criterion evidence when explicit suggestions are missing', () => {
    const normalized = (service as any).normalizeEvaluationPayload(
      {
        overallBand: 7,
        breakdown: {
          taskResponse: 7,
          coherenceCohesion: 7,
          lexicalResource: 7,
          grammaticalRangeAccuracy: 7
        },
        feedback: {
          summary: 'Band 7 with clear room to improve precision.',
          criteria: {
            taskAchievementOrResponse: {
              band: 7,
              descriptorSummary: 'Adequate task response',
              strengths: ['Stays on topic'],
              limitations: ['Needs sharper examples'],
              evidence: [
                {
                  issue: 'Claim too broad',
                  quotedText: 'People like it.',
                  whyItCostsBand: 'Not specific enough.',
                  revision: 'Many urban commuters prefer it because it is cheaper.',
                  whyRevisionIsBetter: 'Adds scope and reason.',
                  practiceInstruction: 'Add one specific reason after each claim.'
                }
              ]
            },
            coherenceCohesion: {
              band: 7,
              descriptorSummary: 'Generally logical progression'
            },
            lexicalResource: {
              band: 7,
              descriptorSummary: 'Adequate vocabulary control'
            },
            grammaticalRangeAccuracy: {
              band: 7,
              descriptorSummary: 'Mostly accurate grammar'
            }
          }
        }
      },
      {
        wordCount: 280,
        taskType: 'task2',
        track: 'academic'
      }
    );

    expect(normalized.feedback.inlineSuggestions.length).toBeGreaterThan(0);
    expect(normalized.feedback.inlineSuggestions[0]).toContain('specific reason');
    expect(normalized.feedback.strengths.length).toBeGreaterThan(0);
    expect(normalized.feedback.improvements.length).toBeGreaterThan(0);
  });

  it('uses Task Response label for task2 criterion fallback', () => {
    const normalized = (service as any).normalizeEvaluationPayload(
      {},
      {
        wordCount: 280,
        taskType: 'task2',
        track: 'general'
      }
    );

    expect(normalized.feedback.criteria.taskAchievementOrResponse.descriptorSummary).toMatch(/Task Response/i);
  });

  it('omits deep-only fields when WRITING_DEEP_FEEDBACK_V2 is disabled', () => {
    const previous = env.writing.deepFeedbackV2Enabled;
    env.writing.deepFeedbackV2Enabled = false;

    try {
      const normalized = (service as any).normalizeEvaluationPayload(
        {},
        {
          wordCount: 260,
          taskType: 'task2',
          track: 'academic'
        }
      );

      expect(normalized.feedbackVersion).toBe('v1');
      expect(normalized.deepFeedbackReady).toBe(false);
      expect(normalized.feedback.overall).toBeUndefined();
      expect(normalized.feedback.criteria).toBeUndefined();
      expect(Array.isArray(normalized.feedback.inlineSuggestions)).toBe(true);
    } finally {
      env.writing.deepFeedbackV2Enabled = previous;
    }
  });
});
