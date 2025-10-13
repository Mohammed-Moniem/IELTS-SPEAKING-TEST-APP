/**
 * Analytics Service
 * Provides comprehensive progress tracking and performance analytics
 */

import { Db, MongoClient, ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { env } from '../../env';
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

@Service()
export class AnalyticsService {
  private log = new Logger(__filename);
  private db: Db;

  async initializeMongoDB(): Promise<void> {
    try {
      const client = await MongoClient.connect(env.db.mongoURL);
      this.db = client.db();
      this.log.info('✅ Analytics MongoDB initialized');
    } catch (error) {
      this.log.error('❌ Failed to initialize Analytics MongoDB:', error);
      throw error;
    }
  }

  /**
   * Save test result to history
   */
  async saveTestResult(testData: Partial<TestHistory>): Promise<TestHistory> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);
    const testHistory = TestHistoryModel.create(testData);

    const result = await collection.insertOne(testHistory as any);
    testHistory._id = result.insertedId.toString();

    this.log.info(`📊 Test result saved: ${testHistory._id} - Band ${testHistory.overallBand}`);
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
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);

    // Query parameters
    const query: any = { userId };
    if (options?.daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
      query.createdAt = { $gte: cutoffDate };
    }

    const tests = await collection.find(query).sort({ createdAt: -1 }).toArray();

    if (tests.length === 0) {
      return this.getEmptyStats();
    }

    // Calculate statistics
    const practiceTests = tests.filter(t => t.testType === TestType.PRACTICE);
    const simulationTests = tests.filter(t => t.testType === TestType.SIMULATION);

    const bands = tests.map(t => t.overallBand);
    const averageBand = bands.reduce((sum, b) => sum + b, 0) / bands.length;
    const highestBand = Math.max(...bands);
    const lowestBand = Math.min(...bands);

    // Calculate band trend
    const bandTrend = this.calculateBandTrend(tests);

    // Calculate criteria averages
    const criteriaAverages = this.calculateCriteriaAverages(tests);

    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(criteriaAverages);

    // Recent tests
    const recentTests = tests.slice(0, options?.includeTests || 10);

    // Monthly progress
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
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);
    const tests = await collection.find({ userId }).toArray();

    if (tests.length === 0) {
      return [];
    }

    // Group by band (rounded to 0.5)
    const bandCounts = new Map<number, number>();
    tests.forEach(test => {
      const roundedBand = Math.round(test.overallBand * 2) / 2;
      bandCounts.set(roundedBand, (bandCounts.get(roundedBand) || 0) + 1);
    });

    // Convert to array and calculate percentages
    const distribution: BandDistribution[] = Array.from(bandCounts.entries())
      .map(([band, count]) => ({
        band,
        count,
        percentage: Math.round((count / tests.length) * 100)
      }))
      .sort((a, b) => b.band - a.band);

    return distribution;
  }

  /**
   * Get performance by topic
   */
  async getTopicPerformance(userId: string, limit: number = 10): Promise<TopicPerformance[]> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);
    const tests = await collection.find({ userId }).toArray();

    if (tests.length === 0) {
      return [];
    }

    // Group by topic
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

    // Calculate averages and sort by test count
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
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);

    const currentDate = new Date();
    const midpoint = new Date();
    midpoint.setDate(midpoint.getDate() - daysBack / 2);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get current period tests
    const currentTests = await collection.find({ userId, createdAt: { $gte: midpoint } }).toArray();

    // Get previous period tests
    const previousTests = await collection.find({ userId, createdAt: { $gte: startDate, $lt: midpoint } }).toArray();

    if (currentTests.length === 0 || previousTests.length === 0) {
      return [];
    }

    const currentAvg = this.calculateCriteriaAverages(currentTests);
    const previousAvg = this.calculateCriteriaAverages(previousTests);

    const comparisons: CriteriaComparison[] = [
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

    return comparisons;
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
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);

    const query: any = { userId };
    if (options?.testType) {
      query.testType = options.testType;
    }

    const total = await collection.countDocuments(query);
    const tests = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 20)
      .toArray();

    return { tests: tests as TestHistory[], total };
  }

  /**
   * Get single test details
   */
  async getTestDetails(testId: string): Promise<TestHistory | null> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);
    const test = await collection.findOne({ _id: new ObjectId(testId) as any });

    return test as TestHistory | null;
  }

  /**
   * Delete test from history
   */
  async deleteTest(testId: string): Promise<void> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<TestHistory>(TestHistoryModel.collectionName);
    await collection.deleteOne({ _id: new ObjectId(testId) as any });

    this.log.info(`🗑️  Deleted test: ${testId}`);
  }

  /**
   * Helper: Calculate band trend
   */
  private calculateBandTrend(tests: TestHistory[]): 'improving' | 'declining' | 'stable' {
    if (tests.length < 5) return 'stable';

    // Compare average of recent 5 vs previous 5
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

  /**
   * Helper: Calculate criteria averages
   */
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

  /**
   * Helper: Identify strengths and weaknesses
   */
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

  /**
   * Helper: Calculate monthly progress
   */
  private calculateMonthlyProgress(tests: TestHistory[]): MonthlyProgress[] {
    const monthlyData = new Map<string, { bands: number[]; practice: number; simulation: number }>();

    tests.forEach(test => {
      const month = test.createdAt.toISOString().substring(0, 7); // 'YYYY-MM'

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

    const progress: MonthlyProgress[] = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        testCount: data.bands.length,
        averageBand: Math.round((data.bands.reduce((sum, b) => sum + b, 0) / data.bands.length) * 10) / 10,
        practiceCount: data.practice,
        simulationCount: data.simulation
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return progress;
  }

  /**
   * Helper: Get trend direction
   */
  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const diff = current - previous;
    if (diff > 0.2) return 'up';
    if (diff < -0.2) return 'down';
    return 'stable';
  }

  /**
   * Helper: Get empty stats structure
   */
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
