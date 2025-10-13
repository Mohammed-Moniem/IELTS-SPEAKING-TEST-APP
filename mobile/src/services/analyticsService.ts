/**
 * Analytics Service
 * Processes and aggregates practice/simulation data for visualizations
 */

import { PracticeSession, TestSimulation } from "../types/api";

export interface ScoreDataPoint {
  date: string; // ISO date string
  score: number;
  type: "practice" | "simulation";
  sessionId: string;
}

export interface CategoryPerformance {
  category: string;
  averageScore: number;
  sessionCount: number;
  latestScore?: number;
  trend: "improving" | "declining" | "stable";
}

export interface TimeOfDayStats {
  hour: number; // 0-23
  sessionCount: number;
  averageScore: number;
}

export interface ProgressStats {
  totalSessions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  improvementRate: number; // percentage
  currentStreak: number;
  longestStreak: number;
}

export interface ScoreTrend {
  period: "week" | "month" | "all";
  dataPoints: ScoreDataPoint[];
  trendLine: { x: number; y: number }[];
  averageScore: number;
  improvement: number; // percentage change
}

export interface BandDistribution {
  band: number;
  count: number;
  percentage: number;
}

class AnalyticsService {
  /**
   * Calculate overall progress statistics
   */
  calculateProgressStats(
    practices: PracticeSession[],
    simulations: TestSimulation[]
  ): ProgressStats {
    const allScores: number[] = [];
    const allDates: string[] = [];

    // Collect practice scores
    practices.forEach((session) => {
      if (session.feedback?.overallBand) {
        allScores.push(session.feedback.overallBand);
        allDates.push(session.completedAt || session.createdAt);
      }
    });

    // Collect simulation scores
    simulations.forEach((sim) => {
      if (sim.overallBand) {
        allScores.push(sim.overallBand);
        allDates.push(sim.completedAt || sim.createdAt);
      }
    });

    if (allScores.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        improvementRate: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    // Calculate basic stats
    const totalSessions = allScores.length;
    const averageScore =
      allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const highestScore = Math.max(...allScores);
    const lowestScore = Math.min(...allScores);

    // Calculate improvement rate (compare first 5 vs last 5 sessions)
    const improvementRate = this.calculateImprovementRate(allScores);

    // Calculate streaks
    const { currentStreak, longestStreak } = this.calculateStreaks(allDates);

    return {
      totalSessions,
      averageScore: Math.round(averageScore * 10) / 10,
      highestScore,
      lowestScore,
      improvementRate,
      currentStreak,
      longestStreak,
    };
  }

  /**
   * Get score data points for charting
   */
  getScoreDataPoints(
    practices: PracticeSession[],
    simulations: TestSimulation[]
  ): ScoreDataPoint[] {
    const dataPoints: ScoreDataPoint[] = [];

    // Add practice sessions
    practices.forEach((session) => {
      if (session.feedback?.overallBand) {
        dataPoints.push({
          date: session.completedAt || session.createdAt,
          score: session.feedback.overallBand,
          type: "practice",
          sessionId: session._id,
        });
      }
    });

    // Add simulations
    simulations.forEach((sim) => {
      if (sim.overallBand) {
        dataPoints.push({
          date: sim.completedAt || sim.createdAt,
          score: sim.overallBand,
          type: "simulation",
          sessionId: sim._id,
        });
      }
    });

    // Sort by date
    return dataPoints.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  /**
   * Calculate score trend for a given period
   */
  calculateScoreTrend(
    dataPoints: ScoreDataPoint[],
    period: "week" | "month" | "all"
  ): ScoreTrend {
    // Filter by period
    const now = new Date();
    const filteredPoints = dataPoints.filter((point) => {
      const pointDate = new Date(point.date);
      const daysDiff =
        (now.getTime() - pointDate.getTime()) / (1000 * 60 * 60 * 24);

      if (period === "week") return daysDiff <= 7;
      if (period === "month") return daysDiff <= 30;
      return true; // 'all'
    });

    if (filteredPoints.length === 0) {
      return {
        period,
        dataPoints: [],
        trendLine: [],
        averageScore: 0,
        improvement: 0,
      };
    }

    // Calculate average
    const averageScore =
      filteredPoints.reduce((sum, p) => sum + p.score, 0) /
      filteredPoints.length;

    // Calculate improvement (first half vs second half)
    const improvement = this.calculatePeriodImprovement(filteredPoints);

    // Calculate trend line (simple linear regression)
    const trendLine = this.calculateTrendLine(filteredPoints);

    return {
      period,
      dataPoints: filteredPoints,
      trendLine,
      averageScore: Math.round(averageScore * 10) / 10,
      improvement,
    };
  }

  /**
   * Calculate performance by category (Part 1, Part 2, Part 3)
   */
  calculateCategoryPerformance(
    practices: PracticeSession[]
  ): CategoryPerformance[] {
    const categoryMap = new Map<
      string,
      { scores: number[]; sessions: PracticeSession[] }
    >();

    // Group by category
    practices.forEach((session) => {
      if (session.feedback?.overallBand) {
        const category = `Part ${session.part}`;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { scores: [], sessions: [] });
        }
        categoryMap.get(category)!.scores.push(session.feedback.overallBand);
        categoryMap.get(category)!.sessions.push(session);
      }
    });

    // Calculate stats for each category
    const result: CategoryPerformance[] = [];
    categoryMap.forEach((data, category) => {
      const averageScore =
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const latestScore = data.scores[data.scores.length - 1];
      const trend = this.calculateTrend(data.scores);

      result.push({
        category,
        averageScore: Math.round(averageScore * 10) / 10,
        sessionCount: data.scores.length,
        latestScore,
        trend,
      });
    });

    return result.sort((a, b) => a.category.localeCompare(b.category));
  }

  /**
   * Calculate performance by time of day
   */
  calculateTimeOfDayStats(
    practices: PracticeSession[],
    simulations: TestSimulation[]
  ): TimeOfDayStats[] {
    const hourMap = new Map<number, { scores: number[]; count: number }>();

    // Process practices
    practices.forEach((session) => {
      if (session.feedback?.overallBand) {
        const hour = new Date(session.createdAt).getHours();
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { scores: [], count: 0 });
        }
        hourMap.get(hour)!.scores.push(session.feedback.overallBand);
        hourMap.get(hour)!.count++;
      }
    });

    // Process simulations
    simulations.forEach((sim) => {
      if (sim.overallBand) {
        const hour = new Date(sim.createdAt).getHours();
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { scores: [], count: 0 });
        }
        hourMap.get(hour)!.scores.push(sim.overallBand);
        hourMap.get(hour)!.count++;
      }
    });

    // Convert to array
    const result: TimeOfDayStats[] = [];
    hourMap.forEach((data, hour) => {
      const averageScore =
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      result.push({
        hour,
        sessionCount: data.count,
        averageScore: Math.round(averageScore * 10) / 10,
      });
    });

    return result.sort((a, b) => a.hour - b.hour);
  }

  /**
   * Calculate band score distribution
   */
  calculateBandDistribution(
    practices: PracticeSession[],
    simulations: TestSimulation[]
  ): BandDistribution[] {
    const bandCounts = new Map<number, number>();
    let totalCount = 0;

    // Count practice bands
    practices.forEach((session) => {
      if (session.feedback?.overallBand) {
        const band = Math.floor(session.feedback.overallBand);
        bandCounts.set(band, (bandCounts.get(band) || 0) + 1);
        totalCount++;
      }
    });

    // Count simulation bands
    simulations.forEach((sim) => {
      if (sim.overallBand) {
        const band = Math.floor(sim.overallBand);
        bandCounts.set(band, (bandCounts.get(band) || 0) + 1);
        totalCount++;
      }
    });

    // Convert to array with percentages
    const result: BandDistribution[] = [];
    for (let band = 1; band <= 9; band++) {
      const count = bandCounts.get(band) || 0;
      result.push({
        band,
        count,
        percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
      });
    }

    return result;
  }

  /**
   * Calculate improvement rate (comparing early vs recent sessions)
   */
  private calculateImprovementRate(scores: number[]): number {
    if (scores.length < 2) return 0;

    const sampleSize = Math.min(5, Math.floor(scores.length / 2));
    const earlyScores = scores.slice(0, sampleSize);
    const recentScores = scores.slice(-sampleSize);

    const earlyAvg =
      earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length;
    const recentAvg =
      recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

    if (earlyAvg === 0) return 0;
    return Math.round(((recentAvg - earlyAvg) / earlyAvg) * 100);
  }

  /**
   * Calculate improvement for a specific period
   */
  private calculatePeriodImprovement(dataPoints: ScoreDataPoint[]): number {
    if (dataPoints.length < 2) return 0;

    const midPoint = Math.floor(dataPoints.length / 2);
    const firstHalf = dataPoints.slice(0, midPoint);
    const secondHalf = dataPoints.slice(midPoint);

    const firstAvg =
      firstHalf.reduce((sum, p) => sum + p.score, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, p) => sum + p.score, 0) / secondHalf.length;

    if (firstAvg === 0) return 0;
    return Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
  }

  /**
   * Calculate trend (improving, declining, stable)
   */
  private calculateTrend(
    scores: number[]
  ): "improving" | "declining" | "stable" {
    if (scores.length < 3) return "stable";

    const recent = scores.slice(-3);
    const earlier = scores.slice(0, Math.max(3, scores.length - 3));

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    const diff = recentAvg - earlierAvg;

    if (diff > 0.2) return "improving";
    if (diff < -0.2) return "declining";
    return "stable";
  }

  /**
   * Calculate trend line using simple linear regression
   */
  private calculateTrendLine(
    dataPoints: ScoreDataPoint[]
  ): { x: number; y: number }[] {
    if (dataPoints.length < 2) return [];

    const n = dataPoints.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    dataPoints.forEach((point, index) => {
      sumX += index;
      sumY += point.score;
      sumXY += index * point.score;
      sumX2 += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate trend line points
    return [
      { x: 0, y: intercept },
      { x: n - 1, y: slope * (n - 1) + intercept },
    ];
  }

  /**
   * Calculate practice streaks
   */
  private calculateStreaks(dates: string[]): {
    currentStreak: number;
    longestStreak: number;
  } {
    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Convert to date objects and sort
    const sortedDates = dates
      .map((d) => new Date(d).toDateString())
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Remove duplicates (same day)
    const uniqueDates = [...new Set(sortedDates)];

    let currentStreak = 1;
    let longestStreak = 1;
    let tempStreak = 1;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const daysDiff = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate current streak
    const lastDate = uniqueDates[uniqueDates.length - 1];
    if (lastDate === today || lastDate === yesterday) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }

    return { currentStreak, longestStreak };
  }

  /**
   * Format hour for display (e.g., "9 AM", "2 PM")
   */
  formatHour(hour: number): string {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  /**
   * Get color for trend
   */
  getTrendColor(trend: "improving" | "declining" | "stable"): string {
    switch (trend) {
      case "improving":
        return "#10B981"; // Green
      case "declining":
        return "#EF4444"; // Red
      case "stable":
        return "#6B7280"; // Gray
    }
  }

  /**
   * Get color for band score
   */
  getBandColor(band: number): string {
    if (band >= 8) return "#10B981"; // Excellent - Green
    if (band >= 7) return "#3B82F6"; // Good - Blue
    if (band >= 6) return "#F59E0B"; // Competent - Orange
    if (band >= 5) return "#EF4444"; // Limited - Red
    return "#6B7280"; // Very Limited - Gray
  }
}

export default new AnalyticsService();
