/**
 * Analytics Service
 * Provides comprehensive progress tracking and performance analytics
 */

import { generateMongoStyleId } from '@lib/db/id';
import { deleteRowsByIds, loadTableRows, upsertRow } from '@lib/db/documentStore';
import { EXTRA_TABLES } from '@lib/db/tableMappings';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';
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
  month: string;
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

@Service()
export class AnalyticsService {
  private log = new Logger(__filename);

  private async listRows(): Promise<TestHistory[]> {
    const rows = await loadTableRows(EXTRA_TABLES.testHistory);
    return rows.map(row => {
      const data = row.data as TestHistory;
      return {
        ...data,
        _id: row.id,
        createdAt: new Date(data.createdAt || row.createdAt),
        completedAt: new Date(data.completedAt || data.createdAt || row.createdAt)
      };
    });
  }

  /**
   * Save test result to history
   */
  async saveTestResult(testData: Partial<TestHistory>): Promise<TestHistory> {
    const testHistory = TestHistoryModel.create(testData);
    testHistory._id = generateMongoStyleId();

    await upsertRow(EXTRA_TABLES.testHistory, testHistory._id, {
      ...testHistory,
      createdAt: new Date(testHistory.createdAt).toISOString(),
      completedAt: new Date(testHistory.completedAt).toISOString()
    });

    this.log.info(`Test result saved: ${testHistory._id} - Band ${testHistory.overallBand}`);
    return testHistory;
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
    let tests = (await this.listRows()).filter(test => test.userId === userId);

    if (options?.daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
      tests = tests.filter(test => test.createdAt >= cutoffDate);
    }

    tests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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

  async getBandDistribution(userId: string): Promise<BandDistribution[]> {
    const tests = (await this.listRows()).filter(test => test.userId === userId);
    if (tests.length === 0) {
      return [];
    }

    const bandCounts = new Map<number, number>();
    tests.forEach(test => {
      const roundedBand = Math.round(test.overallBand * 2) / 2;
      bandCounts.set(roundedBand, (bandCounts.get(roundedBand) || 0) + 1);
    });

    return Array.from(bandCounts.entries())
      .map(([band, count]) => ({
        band,
        count,
        percentage: Math.round((count / tests.length) * 100)
      }))
      .sort((a, b) => b.band - a.band);
  }

  async getTopicPerformance(userId: string, limit: number = 10): Promise<TopicPerformance[]> {
    const tests = (await this.listRows()).filter(test => test.userId === userId);
    if (tests.length === 0) {
      return [];
    }

    const topicStats = new Map<string, { bands: number[]; dates: Date[] }>();
    tests.forEach(test => {
      if (!test.topic) return;

      if (!topicStats.has(test.topic)) {
        topicStats.set(test.topic, { bands: [], dates: [] });
      }

      const stats = topicStats.get(test.topic)!;
      stats.bands.push(test.overallBand);
      stats.dates.push(test.createdAt);
    });

    return Array.from(topicStats.entries())
      .map(([topic, stats]) => ({
        topic,
        testCount: stats.bands.length,
        averageBand: Math.round((stats.bands.reduce((sum, b) => sum + b, 0) / stats.bands.length) * 10) / 10,
        lastTested: new Date(Math.max(...stats.dates.map(d => d.getTime())))
      }))
      .sort((a, b) => b.testCount - a.testCount)
      .slice(0, limit);
  }

  async compareCriteriaPerformance(userId: string, daysBack: number = 30): Promise<CriteriaComparison[]> {
    const tests = (await this.listRows()).filter(test => test.userId === userId);

    const midpoint = new Date();
    midpoint.setDate(midpoint.getDate() - daysBack / 2);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const currentTests = tests.filter(test => test.createdAt >= midpoint);
    const previousTests = tests.filter(test => test.createdAt >= startDate && test.createdAt < midpoint);

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

  async getTestHistory(
    userId: string,
    options?: {
      limit?: number;
      skip?: number;
      testType?: TestType;
    }
  ): Promise<{ tests: TestHistory[]; total: number }> {
    let tests = (await this.listRows()).filter(test => test.userId === userId);

    if (options?.testType) {
      tests = tests.filter(test => test.testType === options.testType);
    }

    tests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = tests.length;
    const skip = options?.skip || 0;
    const limit = options?.limit || 20;

    return {
      tests: tests.slice(skip, skip + limit),
      total
    };
  }

  async getTestDetails(testId: string): Promise<TestHistory | null> {
    const tests = await this.listRows();
    return tests.find(test => test._id === testId) || null;
  }

  async deleteTest(testId: string): Promise<void> {
    await deleteRowsByIds(EXTRA_TABLES.testHistory, [testId]);
    this.log.info(`Deleted test: ${testId}`);
  }

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
      sums.fluencyCoherence += test.criteria.fluencyCoherence.band;
      sums.lexicalResource += test.criteria.lexicalResource.band;
      sums.grammaticalRange += test.criteria.grammaticalRange.band;
      sums.pronunciation += test.criteria.pronunciation.band;
    });

    const count = tests.length;
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
        data.practice += 1;
      } else {
        data.simulation += 1;
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
