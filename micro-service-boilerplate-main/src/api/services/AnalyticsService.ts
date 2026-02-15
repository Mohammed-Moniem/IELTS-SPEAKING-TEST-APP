/**
 * Analytics Service (Supabase/Postgres)
 * Provides comprehensive progress tracking and performance analytics.
 *
 * This replaces the legacy MongoDB implementation by persisting into
 * `public.test_history` (JSONB for criteria/corrections/suggestions).
 */

import { Service } from 'typedi';

import { Logger } from '../../lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { TestHistory, TestHistoryModel, TestType } from '../models/TestHistory';

export interface ProgressStats {
  totalTests: number;
  practiceTests: number;
  simulationTests: number;
  averageBand: number;
  highestBand: number;
  lowestBand: number;
  bandTrend: 'improving' | 'declining' | 'stable';

  criteriaAverages: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRange: number;
    pronunciation: number;
  };

  strengths: string[];
  weaknesses: string[];

  recentTests: TestHistory[];
  monthlyProgress: MonthlyProgress[];
}

export interface MonthlyProgress {
  month: string; // 'YYYY-MM'
  testCount: number;
  averageBand: number;
  practiceCount: number;
  simulationCount: number;
}

export interface BandDistribution {
  band: number;
  count: number;
  percentage: number;
}

export interface TopicPerformance {
  topic: string;
  testCount: number;
  averageBand: number;
  lastTested: Date;
}

export interface CriteriaComparison {
  criterion: string;
  currentAverage: number;
  previousAverage: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

type TestHistoryRow = {
  id: string;
  user_id: string;
  session_id: string;
  test_type: 'practice' | 'simulation';
  topic: string;
  test_part: string | null;
  duration_seconds: number;
  completed_at: string;
  overall_band: number;
  criteria: any;
  corrections: any;
  suggestions: any;
  audio_recording_id: string | null;
  metadata: any;
  created_at: string;
};

type UserStatsRow = {
  user_id: string;
  total_practice_sessions: number;
  total_simulations: number;
  average_score: number;
  highest_score: number;
  current_streak: number;
  longest_streak: number;
  weekly_score: number;
  monthly_score: number;
  weekly_practices: number;
  monthly_practices: number;
  last_practice_at?: string | null;
};

function toTestHistory(row: TestHistoryRow): TestHistory {
  return {
    _id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    testType: row.test_type as TestType,
    topic: row.topic,
    testPart: row.test_part || undefined,
    durationSeconds: row.duration_seconds || 0,
    completedAt: new Date(row.completed_at),
    overallBand: Number(row.overall_band),
    criteria: row.criteria,
    corrections: Array.isArray(row.corrections) ? row.corrections : row.corrections || [],
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : row.suggestions || [],
    audioRecordingId: row.audio_recording_id || undefined,
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at)
  };
}

@Service()
export class AnalyticsService {
  private log = new Logger(__filename);

  private startOfDayUtc(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private async updateUserStatsFromTest(params: {
    userId: string;
    overallBand: number;
    testType: TestType;
    completedAt: Date;
  }): Promise<void> {
    const supabase = getSupabaseAdmin();
    const userId = params.userId;

    const { data: existing, error } = await supabase
      .from('user_stats')
      .select(
        'user_id, total_practice_sessions, total_simulations, average_score, highest_score, current_streak, longest_streak, weekly_score, monthly_score, weekly_practices, monthly_practices, last_practice_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.log.warn('Failed to load user_stats (will upsert defaults)', { userId, error: error.message });
    }

    const stats = (existing as UserStatsRow | null) || {
      user_id: userId,
      total_practice_sessions: 0,
      total_simulations: 0,
      average_score: 0,
      highest_score: 0,
      current_streak: 0,
      longest_streak: 0,
      weekly_score: 0,
      monthly_score: 0,
      weekly_practices: 0,
      monthly_practices: 0,
      last_practice_at: null
    };

    const isPractice = params.testType === TestType.PRACTICE;

    const prevTotal = Number(stats.total_practice_sessions || 0) + Number(stats.total_simulations || 0);
    const nextTotal = prevTotal + 1;
    const prevAverage = Number(stats.average_score || 0);
    const nextAverage = nextTotal > 0 ? (prevAverage * prevTotal + Number(params.overallBand || 0)) / nextTotal : 0;

    const nextHighest = Math.max(Number(stats.highest_score || 0), Number(params.overallBand || 0));

    let currentStreak = Number(stats.current_streak || 0);
    let longestStreak = Number(stats.longest_streak || 0);
    let lastPracticeAt: string | null | undefined = stats.last_practice_at ?? null;

    if (isPractice) {
      const completedAt = params.completedAt || new Date();
      const today = this.startOfDayUtc(completedAt);

      if (lastPracticeAt) {
        const last = this.startOfDayUtc(new Date(lastPracticeAt));
        const daysDiff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 0) {
          // same day: streak unchanged
        } else if (daysDiff === 1) {
          currentStreak = Math.max(1, currentStreak + 1);
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      longestStreak = Math.max(longestStreak, currentStreak);
      lastPracticeAt = completedAt.toISOString();
    }

    const nextPayload = {
      user_id: userId,
      total_practice_sessions: Number(stats.total_practice_sessions || 0) + (isPractice ? 1 : 0),
      total_simulations: Number(stats.total_simulations || 0) + (isPractice ? 0 : 1),
      average_score: Math.round(nextAverage * 10) / 10,
      highest_score: Math.round(nextHighest * 10) / 10,
      weekly_score: Math.round(nextAverage * 10) / 10,
      monthly_score: Math.round(nextAverage * 10) / 10,
      weekly_practices: Number(stats.weekly_practices || 0) + (isPractice ? 1 : 0),
      monthly_practices: Number(stats.monthly_practices || 0) + (isPractice ? 1 : 0),
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_practice_at: lastPracticeAt
    };

    const { error: upsertError } = await supabase.from('user_stats').upsert(nextPayload, { onConflict: 'user_id' });
    if (upsertError) {
      this.log.warn('Failed to update user_stats', { userId, error: upsertError.message });
    }
  }

  /**
   * Save test result to history
   */
  async saveTestResult(testData: Partial<TestHistory>): Promise<TestHistory> {
    const supabase = getSupabaseAdmin();
    const testHistory = TestHistoryModel.create(testData);

    const insertPayload = {
      user_id: testHistory.userId,
      session_id: testHistory.sessionId,
      test_type: testHistory.testType,
      topic: testHistory.topic,
      test_part: testHistory.testPart || null,
      duration_seconds: testHistory.durationSeconds || 0,
      completed_at: testHistory.completedAt?.toISOString?.() || new Date().toISOString(),
      overall_band: testHistory.overallBand,
      criteria: testHistory.criteria,
      corrections: testHistory.corrections || [],
      suggestions: testHistory.suggestions || [],
      audio_recording_id: testHistory.audioRecordingId || null,
      metadata: testHistory.metadata || {},
      created_at: testHistory.createdAt?.toISOString?.() || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('test_history')
      .insert(insertPayload)
      .select(
        'id, user_id, session_id, test_type, topic, test_part, duration_seconds, completed_at, overall_band, criteria, corrections, suggestions, audio_recording_id, metadata, created_at'
      )
      .single();

    if (error || !data) {
      this.log.error('❌ Failed to save test history', { error: error?.message || error });
      throw new Error('Failed to save test result');
    }

    const saved = toTestHistory(data as TestHistoryRow);
    this.log.info(`📊 Test result saved: ${saved._id} - Band ${saved.overallBand}`);

    // Keep leaderboard/achievements stats in sync (best-effort).
    await this.updateUserStatsFromTest({
      userId: saved.userId,
      overallBand: saved.overallBand,
      testType: saved.testType as TestType,
      completedAt: saved.completedAt || new Date()
    });

    return saved;
  }

  /**
   * Get comprehensive progress statistics
   */
  async getProgressStats(
    userId: string,
    options?: {
      daysBack?: number;
      includeTests?: number;
    }
  ): Promise<ProgressStats> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('test_history')
      .select(
        'id, user_id, session_id, test_type, topic, test_part, duration_seconds, completed_at, overall_band, criteria, corrections, suggestions, audio_recording_id, metadata, created_at',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.daysBack) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - options.daysBack);
      query = query.gte('created_at', cutoff.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      this.log.error('❌ Failed to fetch test history for stats', { userId, error: error.message });
      throw new Error('Failed to load analytics');
    }

    const tests = (data || []).map(row => toTestHistory(row as TestHistoryRow));
    if (tests.length === 0) {
      return this.getEmptyStats();
    }

    const practiceTests = tests.filter(t => t.testType === TestType.PRACTICE);
    const simulationTests = tests.filter(t => t.testType === TestType.SIMULATION);

    const bands = tests.map(t => t.overallBand);
    const averageBand = bands.reduce((sum, b) => sum + b, 0) / bands.length;
    const highestBand = Math.max(...bands);
    const lowestBand = Math.min(...bands);

    const bandTrend = this.calculateBandTrend(tests);
    const criteriaAverages = this.calculateCriteriaAverages(tests);
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(criteriaAverages);

    const recentTests = tests.slice(0, options?.includeTests || 10);
    const monthlyProgress = this.calculateMonthlyProgress(tests);

    return {
      totalTests: tests.length,
      practiceTests: practiceTests.length,
      simulationTests: simulationTests.length,
      averageBand: Math.round(averageBand * 10) / 10,
      highestBand,
      lowestBand,
      bandTrend,
      criteriaAverages,
      strengths,
      weaknesses,
      recentTests,
      monthlyProgress
    };
  }

  /**
   * Get band distribution
   */
  async getBandDistribution(userId: string): Promise<BandDistribution[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('test_history')
      .select('overall_band')
      .eq('user_id', userId);

    if (error) {
      this.log.error('❌ Failed to fetch band distribution', { userId, error: error.message });
      throw new Error('Failed to load band distribution');
    }

    const bands = (data || [])
      .map((row: any) => Number(row.overall_band))
      .filter((b: any) => typeof b === 'number' && !Number.isNaN(b));

    if (bands.length === 0) return [];

    const bandCounts = new Map<number, number>();
    bands.forEach(b => {
      const roundedBand = Math.round(b * 2) / 2;
      bandCounts.set(roundedBand, (bandCounts.get(roundedBand) || 0) + 1);
    });

    const distribution: BandDistribution[] = Array.from(bandCounts.entries())
      .map(([band, count]) => ({
        band,
        count,
        percentage: Math.round((count / bands.length) * 100)
      }))
      .sort((a, b) => b.band - a.band);

    return distribution;
  }

  /**
   * Get performance by topic
   */
  async getTopicPerformance(userId: string, limit: number = 10): Promise<TopicPerformance[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('test_history')
      .select('topic, overall_band, created_at')
      .eq('user_id', userId);

    if (error) {
      this.log.error('❌ Failed to fetch topic performance', { userId, error: error.message });
      throw new Error('Failed to load topic performance');
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    const topicStats = new Map<string, { bands: number[]; dates: Date[] }>();
    rows.forEach((row: any) => {
      if (!row.topic) return;
      if (!topicStats.has(row.topic)) {
        topicStats.set(row.topic, { bands: [], dates: [] });
      }
      const stats = topicStats.get(row.topic)!;
      stats.bands.push(Number(row.overall_band));
      stats.dates.push(new Date(row.created_at));
    });

    const performance: TopicPerformance[] = Array.from(topicStats.entries())
      .map(([topic, stats]) => ({
        topic,
        testCount: stats.bands.length,
        averageBand: Math.round((stats.bands.reduce((sum, b) => sum + b, 0) / stats.bands.length) * 10) / 10,
        lastTested: new Date(Math.max(...stats.dates.map(d => d.getTime())))
      }))
      .sort((a, b) => b.testCount - a.testCount)
      .slice(0, limit);

    return performance;
  }

  /**
   * Compare criteria performance (current vs previous period)
   */
  async compareCriteriaPerformance(userId: string, daysBack: number = 30): Promise<CriteriaComparison[]> {
    const supabase = getSupabaseAdmin();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const midpoint = new Date();
    midpoint.setDate(midpoint.getDate() - daysBack / 2);

    const { data, error } = await supabase
      .from('test_history')
      .select('id, user_id, session_id, test_type, topic, test_part, duration_seconds, completed_at, overall_band, criteria, corrections, suggestions, audio_recording_id, metadata, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this.log.error('❌ Failed to fetch criteria comparison data', { userId, error: error.message });
      throw new Error('Failed to load criteria comparison');
    }

    const tests = (data || []).map(row => toTestHistory(row as TestHistoryRow));
    const currentTests = tests.filter(t => t.createdAt >= midpoint);
    const previousTests = tests.filter(t => t.createdAt < midpoint);

    if (currentTests.length === 0 || previousTests.length === 0) {
      return [];
    }

    const currentAvg = this.calculateCriteriaAverages(currentTests);
    const previousAvg = this.calculateCriteriaAverages(previousTests);

    return [
      {
        criterion: 'Fluency & Coherence',
        currentAverage: currentAvg.fluencyCoherence,
        previousAverage: previousAvg.fluencyCoherence,
        change: currentAvg.fluencyCoherence - previousAvg.fluencyCoherence,
        trend: this.getTrend(currentAvg.fluencyCoherence, previousAvg.fluencyCoherence)
      },
      {
        criterion: 'Lexical Resource',
        currentAverage: currentAvg.lexicalResource,
        previousAverage: previousAvg.lexicalResource,
        change: currentAvg.lexicalResource - previousAvg.lexicalResource,
        trend: this.getTrend(currentAvg.lexicalResource, previousAvg.lexicalResource)
      },
      {
        criterion: 'Grammatical Range',
        currentAverage: currentAvg.grammaticalRange,
        previousAverage: previousAvg.grammaticalRange,
        change: currentAvg.grammaticalRange - previousAvg.grammaticalRange,
        trend: this.getTrend(currentAvg.grammaticalRange, previousAvg.grammaticalRange)
      },
      {
        criterion: 'Pronunciation',
        currentAverage: currentAvg.pronunciation,
        previousAverage: previousAvg.pronunciation,
        change: currentAvg.pronunciation - previousAvg.pronunciation,
        trend: this.getTrend(currentAvg.pronunciation, previousAvg.pronunciation)
      }
    ];
  }

  /**
   * Get test history with pagination
   */
  async getTestHistory(
    userId: string,
    options?: {
      limit?: number;
      skip?: number;
      testType?: TestType;
    }
  ): Promise<{ tests: TestHistory[]; total: number }> {
    const supabase = getSupabaseAdmin();

    const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
    const skip = Math.max(options?.skip || 0, 0);

    let query = supabase
      .from('test_history')
      .select(
        'id, user_id, session_id, test_type, topic, test_part, duration_seconds, completed_at, overall_band, criteria, corrections, suggestions, audio_recording_id, metadata, created_at',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (options?.testType) {
      query = query.eq('test_type', options.testType);
    }

    const { data, error, count } = await query;
    if (error) {
      this.log.error('❌ Failed to fetch test history', { userId, error: error.message });
      throw new Error('Failed to load test history');
    }

    return {
      tests: (data || []).map(row => toTestHistory(row as TestHistoryRow)),
      total: typeof count === 'number' ? count : (data || []).length
    };
  }

  /**
   * Get single test details
   */
  async getTestDetails(userId: string, testId: string): Promise<TestHistory | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('test_history')
      .select(
        'id, user_id, session_id, test_type, topic, test_part, duration_seconds, completed_at, overall_band, criteria, corrections, suggestions, audio_recording_id, metadata, created_at'
      )
      .eq('id', testId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.log.error('❌ Failed to fetch test details', { userId, testId, error: error.message });
      throw new Error('Failed to load test details');
    }

    if (!data) return null;
    return toTestHistory(data as TestHistoryRow);
  }

  /**
   * Delete test from history
   */
  async deleteTest(userId: string, testId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('test_history').delete().eq('id', testId).eq('user_id', userId).select('id');

    if (error) {
      this.log.error('❌ Failed to delete test', { userId, testId, error: error.message });
      throw new Error('Failed to delete test');
    }

    const deleted = Array.isArray(data) && data.length > 0;
    if (deleted) {
      this.log.info(`🗑️  Deleted test: ${testId}`);
    }
    return deleted;
  }

  // Helpers (ported from the legacy implementation)

  private calculateBandTrend(tests: TestHistory[]): 'improving' | 'declining' | 'stable' {
    if (tests.length < 5) return 'stable';

    const recent = tests.slice(0, 5).map(t => t.overallBand);
    const previous = tests.slice(5, 10).map(t => t.overallBand);
    if (previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, b) => sum + b, 0) / recent.length;
    const previousAvg = previous.reduce((sum, b) => sum + b, 0) / previous.length;
    const diff = recentAvg - previousAvg;

    if (diff > 0.3) return 'improving';
    if (diff < -0.3) return 'declining';
    return 'stable';
  }

  private calculateCriteriaAverages(tests: TestHistory[]): ProgressStats['criteriaAverages'] {
    const sums = {
      fluencyCoherence: 0,
      lexicalResource: 0,
      grammaticalRange: 0,
      pronunciation: 0
    };

    tests.forEach(test => {
      sums.fluencyCoherence += Number(test.criteria?.fluencyCoherence?.band || 0);
      sums.lexicalResource += Number(test.criteria?.lexicalResource?.band || 0);
      sums.grammaticalRange += Number(test.criteria?.grammaticalRange?.band || 0);
      sums.pronunciation += Number(test.criteria?.pronunciation?.band || 0);
    });

    const count = Math.max(tests.length, 1);
    return {
      fluencyCoherence: Math.round((sums.fluencyCoherence / count) * 10) / 10,
      lexicalResource: Math.round((sums.lexicalResource / count) * 10) / 10,
      grammaticalRange: Math.round((sums.grammaticalRange / count) * 10) / 10,
      pronunciation: Math.round((sums.pronunciation / count) * 10) / 10
    };
  }

  private identifyStrengthsWeaknesses(averages: ProgressStats['criteriaAverages']): {
    strengths: string[];
    weaknesses: string[];
  } {
    const criteria = [
      { name: 'Fluency & Coherence', score: averages.fluencyCoherence },
      { name: 'Lexical Resource', score: averages.lexicalResource },
      { name: 'Grammatical Range', score: averages.grammaticalRange },
      { name: 'Pronunciation', score: averages.pronunciation }
    ];

    criteria.sort((a, b) => b.score - a.score);
    return {
      strengths: criteria.slice(0, 2).map(c => c.name),
      weaknesses: criteria.slice(2, 4).map(c => c.name)
    };
  }

  private calculateMonthlyProgress(tests: TestHistory[]): MonthlyProgress[] {
    const monthlyData = new Map<string, { bands: number[]; practice: number; simulation: number }>();

    tests.forEach(test => {
      const month = test.createdAt.toISOString().substring(0, 7);
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { bands: [], practice: 0, simulation: 0 });
      }

      const data = monthlyData.get(month)!;
      data.bands.push(test.overallBand);
      if (test.testType === TestType.PRACTICE) {
        data.practice++;
      } else {
        data.simulation++;
      }
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        testCount: data.bands.length,
        averageBand: Math.round((data.bands.reduce((sum, b) => sum + b, 0) / data.bands.length) * 10) / 10,
        practiceCount: data.practice,
        simulationCount: data.simulation
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const diff = current - previous;
    if (diff > 0.2) return 'up';
    if (diff < -0.2) return 'down';
    return 'stable';
  }

  private getEmptyStats(): ProgressStats {
    return {
      totalTests: 0,
      practiceTests: 0,
      simulationTests: 0,
      averageBand: 0,
      highestBand: 0,
      lowestBand: 0,
      bandTrend: 'stable',
      criteriaAverages: {
        fluencyCoherence: 0,
        lexicalResource: 0,
        grammaticalRange: 0,
        pronunciation: 0
      },
      strengths: [],
      weaknesses: [],
      recentTests: [],
      monthlyProgress: []
    };
  }
}
