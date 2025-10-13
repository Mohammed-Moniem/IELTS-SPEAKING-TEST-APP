/**
 * Analytics API Client
 * Handles test history, progress tracking, and performance analytics
 */

import { apiClient } from "./client";

export interface CriteriaScore {
  band: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface TestResult {
  userId: string;
  sessionId: string;
  testType: "practice" | "simulation";
  topic: string;
  testPart?: string;
  durationSeconds: number;
  overallBand: number;
  criteria: {
    fluencyCoherence: CriteriaScore;
    lexicalResource: CriteriaScore;
    grammaticalRange: CriteriaScore;
    pronunciation: CriteriaScore;
  };
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  suggestions?: string[];
  audioRecordingId?: string;
}

export interface TestHistory {
  _id: string;
  userId: string;
  sessionId: string;
  testType: "practice" | "simulation";
  topic: string;
  testPart?: string;
  durationSeconds: number;
  completedAt: string;
  overallBand: number;
  criteria: {
    fluencyCoherence: CriteriaScore;
    lexicalResource: CriteriaScore;
    grammaticalRange: CriteriaScore;
    pronunciation: CriteriaScore;
  };
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  suggestions?: string[];
  audioRecordingId?: string;
  createdAt: string;
}

export interface ProgressStats {
  totalTests: number;
  practiceTests: number;
  simulationTests: number;
  averageBand: number;
  highestBand: number;
  lowestBand: number;
  bandTrend: "improving" | "declining" | "stable";
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
  lastTested: string;
}

export interface CriteriaComparison {
  criterion: string;
  currentAverage: number;
  previousAverage: number;
  change: number;
  trend: "up" | "down" | "stable";
}

/**
 * Save test result to history
 */
export async function saveTestResult(
  testData: TestResult
): Promise<string | null> {
  try {
    console.log("📊 Saving test result...");

    const response = await apiClient.post("/analytics/test", testData);

    if (response.data.success && response.data.data) {
      console.log("✅ Test result saved:", response.data.data.testId);
      return response.data.data.testId;
    } else {
      console.error("❌ Failed to save test result:", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Save test result error:", error);
    return null;
  }
}

/**
 * Get comprehensive progress statistics
 */
export async function getProgressStats(
  userId: string,
  options?: {
    daysBack?: number;
    includeTests?: number;
  }
): Promise<ProgressStats | null> {
  try {
    console.log("📈 Fetching progress stats...");

    const params = new URLSearchParams();
    if (options?.daysBack)
      params.append("daysBack", options.daysBack.toString());
    if (options?.includeTests)
      params.append("includeTests", options.includeTests.toString());

    const queryString = params.toString();
    const url = `/analytics/progress/${userId}${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await apiClient.get(url);

    if (response.data.success && response.data.data) {
      console.log("✅ Progress stats fetched");
      return response.data.data;
    } else {
      console.error("❌ Failed to fetch progress stats:", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Get progress stats error:", error);
    return null;
  }
}

/**
 * Get band distribution
 */
export async function getBandDistribution(
  userId: string
): Promise<BandDistribution[]> {
  try {
    console.log("📊 Fetching band distribution...");

    const response = await apiClient.get(
      `/analytics/band-distribution/${userId}`
    );

    if (response.data.success && response.data.data) {
      console.log("✅ Band distribution fetched");
      return response.data.data.distribution;
    } else {
      console.error(
        "❌ Failed to fetch band distribution:",
        response.data.error
      );
      return [];
    }
  } catch (error) {
    console.error("❌ Get band distribution error:", error);
    return [];
  }
}

/**
 * Get topic performance
 */
export async function getTopicPerformance(
  userId: string,
  limit: number = 10
): Promise<TopicPerformance[]> {
  try {
    console.log("📚 Fetching topic performance...");

    const response = await apiClient.get(
      `/analytics/topics/${userId}?limit=${limit}`
    );

    if (response.data.success && response.data.data) {
      console.log("✅ Topic performance fetched");
      return response.data.data.topics;
    } else {
      console.error(
        "❌ Failed to fetch topic performance:",
        response.data.error
      );
      return [];
    }
  } catch (error) {
    console.error("❌ Get topic performance error:", error);
    return [];
  }
}

/**
 * Compare criteria performance
 */
export async function compareCriteriaPerformance(
  userId: string,
  daysBack: number = 30
): Promise<CriteriaComparison[]> {
  try {
    console.log("🔄 Fetching criteria comparison...");

    const response = await apiClient.get(
      `/analytics/criteria-comparison/${userId}?daysBack=${daysBack}`
    );

    if (response.data.success && response.data.data) {
      console.log("✅ Criteria comparison fetched");
      return response.data.data.comparison;
    } else {
      console.error(
        "❌ Failed to fetch criteria comparison:",
        response.data.error
      );
      return [];
    }
  } catch (error) {
    console.error("❌ Get criteria comparison error:", error);
    return [];
  }
}

/**
 * Get test history with pagination
 */
export async function getTestHistory(
  userId: string,
  options?: {
    limit?: number;
    skip?: number;
    testType?: "practice" | "simulation";
  }
): Promise<{ tests: TestHistory[]; total: number }> {
  try {
    console.log("📜 Fetching test history...");

    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.skip) params.append("skip", options.skip.toString());
    if (options?.testType) params.append("testType", options.testType);

    const queryString = params.toString();
    const url = `/analytics/history/${userId}${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await apiClient.get(url);

    if (response.data.success && response.data.data) {
      console.log(`✅ Fetched ${response.data.data.tests.length} test records`);
      return {
        tests: response.data.data.tests,
        total: response.data.data.total,
      };
    } else {
      console.error("❌ Failed to fetch test history:", response.data.error);
      return { tests: [], total: 0 };
    }
  } catch (error) {
    console.error("❌ Get test history error:", error);
    return { tests: [], total: 0 };
  }
}

/**
 * Get single test details
 */
export async function getTestDetails(
  testId: string
): Promise<TestHistory | null> {
  try {
    console.log("📄 Fetching test details...");

    const response = await apiClient.get(`/analytics/test/${testId}`);

    if (response.data.success && response.data.data) {
      console.log("✅ Test details fetched");
      return response.data.data;
    } else {
      console.error("❌ Failed to fetch test details:", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Get test details error:", error);
    return null;
  }
}

/**
 * Delete test from history
 */
export async function deleteTest(testId: string): Promise<boolean> {
  try {
    console.log("🗑️  Deleting test:", testId);

    const response = await apiClient.delete(`/analytics/test/${testId}`);

    if (response.data.success) {
      console.log("✅ Test deleted successfully");
      return true;
    } else {
      console.error("❌ Failed to delete test:", response.data.error);
      return false;
    }
  } catch (error) {
    console.error("❌ Delete test error:", error);
    return false;
  }
}
