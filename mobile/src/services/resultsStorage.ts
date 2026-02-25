import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "../utils/logger";

const RESULTS_KEY = "@ielts_practice_results";
const FULL_TEST_RESULTS_KEY = "@ielts_full_test_results";
const USED_QUESTIONS_KEY = "@ielts_used_questions";

export interface PracticeResult {
  id: string;
  timestamp: number;
  part: 1 | 2 | 3;
  topic: string;
  question: string;
  transcript: string;
  audioUri: string;
  evaluation: {
    overallBand: number;
    criteria: {
      fluency: { score: number; feedback: string };
      lexicalResource: { score: number; feedback: string };
      grammaticalRange: { score: number; feedback: string };
      pronunciation: { score: number; feedback: string };
    };
    detailed?: {
      fluencyCoherence: any;
      lexicalResource: any;
      grammaticalRange: any;
      pronunciation: any;
    };
    corrections: Array<{
      original: string;
      corrected: string;
      explanation: string;
    }>;
    suggestions: string[];
    bandComparison?: any;
  };
  duration: number; // in seconds
}

export interface FullTestEvaluationDetails {
  overallBand?: number;
  criteria?: any;
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation: string;
    category?: string;
  }>;
  suggestions?: string[];
  bandComparison?: any;
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
}

export interface FullTestResult {
  id: string;
  timestamp: number;
  durationSeconds: number;
  overallBand?: number;
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
  spokenSummary?: string;
  fullTranscript?: string;
  evaluation?: FullTestEvaluationDetails;
  questions?: Array<{
    questionId?: string;
    question: string;
    category: string;
    difficulty?: string;
    topic?: string;
  }>;
  source?: string;
  testSessionId?: string;
}

class ResultsStorageService {
  private normalizeResult(raw: any): PracticeResult {
    const evaluation = raw?.evaluation || {};
    const suggestionsRaw = evaluation.suggestions || [];
    const suggestions: string[] = Array.isArray(suggestionsRaw)
      ? suggestionsRaw
          .map((entry: any) => {
            if (typeof entry === "string") {
              return entry.trim();
            }
            if (entry && typeof entry.suggestion === "string") {
              return entry.suggestion.trim();
            }
            if (entry && typeof entry.text === "string") {
              return entry.text.trim();
            }
            return "";
          })
          .filter((entry) => entry.length > 0)
      : [];

    const correctionsRaw = evaluation.corrections || [];
    const corrections = Array.isArray(correctionsRaw)
      ? correctionsRaw
          .map((entry: any) => ({
            original: typeof entry?.original === "string" ? entry.original : "",
            corrected:
              typeof entry?.corrected === "string" ? entry.corrected : "",
            explanation:
              typeof entry?.explanation === "string" ? entry.explanation : "",
          }))
          .filter(
            (entry) =>
              entry.original.length > 0 ||
              entry.corrected.length > 0 ||
              entry.explanation.length > 0
          )
      : [];

    const detailed = evaluation.detailed || raw?.detailedCriteria || undefined;
    const summary = evaluation.criteria || {};

    const summarizeCriterion = (
      field: any,
      fallback?: { band?: number; feedback?: string }
    ) => {
      if (field && typeof field.score === "number") {
        return {
          score: field.score,
          feedback: field.feedback || "",
        };
      }
      if (field && typeof field.band === "number") {
        return {
          score: field.band,
          feedback: field.feedback || "",
        };
      }
      if (typeof field === "number") {
        return {
          score: field,
          feedback: "",
        };
      }
      return {
        score: fallback?.band || 0,
        feedback: fallback?.feedback || "",
      };
    };

    const normalizedCriteria = {
      fluency: summarizeCriterion(summary.fluency, detailed?.fluencyCoherence),
      lexicalResource: summarizeCriterion(
        summary.lexicalResource,
        detailed?.lexicalResource
      ),
      grammaticalRange: summarizeCriterion(
        summary.grammaticalRange,
        detailed?.grammaticalRange
      ),
      pronunciation: summarizeCriterion(
        summary.pronunciation,
        detailed?.pronunciation
      ),
    };

    return {
      ...raw,
      evaluation: {
        overallBand: Number(evaluation.overallBand) || 0,
        criteria: normalizedCriteria,
        detailed,
        corrections,
        suggestions,
        bandComparison: evaluation.bandComparison,
      },
    } as PracticeResult;
  }

  private normalizeFullTestResult(raw: any): FullTestResult {
    const evaluation = raw?.evaluation || raw?.fullEvaluation || {};

    const normalizeSuggestions = (value: unknown): string[] => {
      if (!Array.isArray(value)) {
        return [];
      }
      return value
        .map((entry) => {
          if (typeof entry === "string") {
            return entry.trim();
          }
          if (
            entry &&
            typeof entry === "object" &&
            typeof (entry as any).suggestion === "string"
          ) {
            const base = (entry as any).suggestion.trim();
            return (entry as any).category
              ? `${(entry as any).category}: ${base}`
              : base;
          }
          return "";
        })
        .filter((entry) => entry.length > 0);
    };

    const normalizeCorrections = (
      value: unknown
    ): FullTestEvaluationDetails["corrections"] => {
      if (!Array.isArray(value)) {
        return [];
      }

      return value
        .map((entry) => {
          const original =
            typeof (entry as any)?.original === "string"
              ? (entry as any).original
              : "";
          const corrected =
            typeof (entry as any)?.corrected === "string"
              ? (entry as any).corrected
              : "";
          const explanation =
            typeof (entry as any)?.explanation === "string"
              ? (entry as any).explanation
              : "";
          const category =
            typeof (entry as any)?.category === "string"
              ? (entry as any).category
              : undefined;

          return {
            original,
            corrected,
            explanation,
            category,
          };
        })
        .filter(
          (entry) => entry.original.length > 0 || entry.corrected.length > 0
        );
    };

    const suggestions = normalizeSuggestions(
      evaluation.suggestions || raw?.suggestions
    );
    const corrections = normalizeCorrections(
      evaluation.corrections || raw?.corrections
    );

    const overallBand = Number(
      evaluation.overallBand ?? raw?.overallBand ?? raw?.band
    );

    const partScores = evaluation.partScores || raw?.partScores || undefined;

    const toPlainQuestion = (value: any) => ({
      questionId:
        typeof value?.questionId === "string" ? value.questionId : undefined,
      question:
        typeof value?.question === "string" ? value.question : "Unknown",
      category: typeof value?.category === "string" ? value.category : "",
      difficulty:
        typeof value?.difficulty === "string" ? value.difficulty : undefined,
      topic: typeof value?.topic === "string" ? value.topic : undefined,
    });

    const questionsArray = Array.isArray(raw?.questions)
      ? raw.questions.map(toPlainQuestion)
      : undefined;

    return {
      id:
        typeof raw?.id === "string"
          ? raw.id
          : `fulltest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Number(raw?.timestamp) || Date.now(),
      durationSeconds: Number(raw?.durationSeconds || raw?.duration) || 0,
      overallBand: Number.isFinite(overallBand) ? overallBand : undefined,
      partScores,
      spokenSummary:
        typeof (raw?.spokenSummary || evaluation.spokenSummary) === "string"
          ? raw?.spokenSummary || evaluation.spokenSummary
          : undefined,
      fullTranscript:
        typeof raw?.fullTranscript === "string"
          ? raw.fullTranscript
          : undefined,
      evaluation: {
        overallBand: Number.isFinite(overallBand) ? overallBand : undefined,
        criteria: evaluation.criteria || raw?.criteria,
        corrections,
        suggestions,
        bandComparison: evaluation.bandComparison || raw?.bandComparison,
        partScores,
      },
      questions: questionsArray,
      source: typeof raw?.source === "string" ? raw.source : undefined,
      testSessionId:
        typeof raw?.testSessionId === "string" ? raw.testSessionId : undefined,
    };
  }

  /**
   * Save a practice result to AsyncStorage
   */
  async savePracticeResult(result: PracticeResult): Promise<void> {
    try {
      const normalized = this.normalizeResult(result);
      const existing = await this.getAllResults();
      const updated = [normalized, ...existing];

      // Keep only the last 100 results
      const trimmed = updated.slice(0, 100);

      await AsyncStorage.setItem(RESULTS_KEY, JSON.stringify(trimmed));
      console.log("✅ Practice result saved to storage:", result.id);
    } catch (error) {
      logger.warn("❌ Failed to save practice result:", error);
      throw error;
    }
  }

  async saveFullTestResult(result: FullTestResult | any): Promise<void> {
    try {
      const normalized = this.normalizeFullTestResult(result);
      const existing = await this.getFullTestResults();
      const updated = [normalized, ...existing];
      const trimmed = updated.slice(0, 50);

      await AsyncStorage.setItem(
        FULL_TEST_RESULTS_KEY,
        JSON.stringify(trimmed)
      );
      console.log("✅ Full test result saved:", normalized.id);
    } catch (error) {
      logger.warn("❌ Failed to save full test result:", error);
    }
  }

  /**
   * Get all practice results from AsyncStorage
   */
  async getAllResults(): Promise<PracticeResult[]> {
    try {
      const data = await AsyncStorage.getItem(RESULTS_KEY);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => this.normalizeResult(item));
    } catch (error) {
      logger.warn("❌ Failed to load practice results:", error);
      return [];
    }
  }

  async getFullTestResults(): Promise<FullTestResult[]> {
    try {
      const data = await AsyncStorage.getItem(FULL_TEST_RESULTS_KEY);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => this.normalizeFullTestResult(item));
    } catch (error) {
      logger.warn("❌ Failed to load full test results:", error);
      return [];
    }
  }

  /**
   * Get a single result by ID
   */
  async getResultById(id: string): Promise<PracticeResult | null> {
    try {
      const results = await this.getAllResults();
      return results.find((r) => r.id === id) || null;
    } catch (error) {
      logger.warn("❌ Failed to get result:", error);
      return null;
    }
  }

  /**
   * Get results filtered by part
   */
  async getResultsByPart(part: 1 | 2 | 3): Promise<PracticeResult[]> {
    try {
      const results = await this.getAllResults();
      return results.filter((r) => r.part === part);
    } catch (error) {
      logger.warn("❌ Failed to get results by part:", error);
      return [];
    }
  }

  /**
   * Get recent results (last N results)
   */
  async getRecentResults(limit: number = 10): Promise<PracticeResult[]> {
    try {
      const results = await this.getAllResults();
      return results.slice(0, limit);
    } catch (error) {
      logger.warn("❌ Failed to get recent results:", error);
      return [];
    }
  }

  /**
   * Delete a result by ID
   */
  async deleteResult(id: string): Promise<void> {
    try {
      const results = await this.getAllResults();
      const filtered = results.filter((r) => r.id !== id);
      await AsyncStorage.setItem(RESULTS_KEY, JSON.stringify(filtered));
      console.log("✅ Result deleted:", id);
    } catch (error) {
      logger.warn("❌ Failed to delete result:", error);
      throw error;
    }
  }

  /**
   * Clear all results
   */
  async clearAllResults(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RESULTS_KEY);
      console.log("✅ All results cleared");
    } catch (error) {
      logger.warn("❌ Failed to clear results:", error);
      throw error;
    }
  }

  async clearFullTestResults(): Promise<void> {
    try {
      await AsyncStorage.removeItem(FULL_TEST_RESULTS_KEY);
      console.log("✅ Full test results cleared");
    } catch (error) {
      logger.warn("❌ Failed to clear full test results:", error);
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    averageBand: number;
    bestBand: number;
    recentTrend: "improving" | "declining" | "stable";
    byPart: {
      part1: { count: number; avgBand: number };
      part2: { count: number; avgBand: number };
      part3: { count: number; avgBand: number };
    };
  }> {
    try {
      const results = await this.getAllResults();

      if (results.length === 0) {
        return {
          totalSessions: 0,
          averageBand: 0,
          bestBand: 0,
          recentTrend: "stable",
          byPart: {
            part1: { count: 0, avgBand: 0 },
            part2: { count: 0, avgBand: 0 },
            part3: { count: 0, avgBand: 0 },
          },
        };
      }

      const totalSessions = results.length;
      const averageBand =
        results.reduce((sum, r) => sum + r.evaluation.overallBand, 0) /
        totalSessions;
      const bestBand = Math.max(
        ...results.map((r) => r.evaluation.overallBand)
      );

      // Calculate trend (compare recent 5 vs previous 5)
      const recent5 = results.slice(0, 5);
      const previous5 = results.slice(5, 10);
      let recentTrend: "improving" | "declining" | "stable" = "stable";

      if (recent5.length >= 3 && previous5.length >= 3) {
        const recentAvg =
          recent5.reduce((sum, r) => sum + r.evaluation.overallBand, 0) /
          recent5.length;
        const previousAvg =
          previous5.reduce((sum, r) => sum + r.evaluation.overallBand, 0) /
          previous5.length;

        if (recentAvg > previousAvg + 0.2) recentTrend = "improving";
        else if (recentAvg < previousAvg - 0.2) recentTrend = "declining";
      }

      // By part statistics
      const byPart = {
        part1: this.calculatePartStats(results, 1),
        part2: this.calculatePartStats(results, 2),
        part3: this.calculatePartStats(results, 3),
      };

      return {
        totalSessions,
        averageBand: parseFloat(averageBand.toFixed(1)),
        bestBand: parseFloat(bestBand.toFixed(1)),
        recentTrend,
        byPart,
      };
    } catch (error) {
      logger.warn("❌ Failed to get statistics:", error);
      throw error;
    }
  }

  private calculatePartStats(
    results: PracticeResult[],
    part: 1 | 2 | 3
  ): { count: number; avgBand: number } {
    const partResults = results.filter((r) => r.part === part);
    if (partResults.length === 0) {
      return { count: 0, avgBand: 0 };
    }

    const avgBand =
      partResults.reduce((sum, r) => sum + r.evaluation.overallBand, 0) /
      partResults.length;

    return {
      count: partResults.length,
      avgBand: parseFloat(avgBand.toFixed(1)),
    };
  }

  /**
   * Mark a question as used to avoid repetition
   */
  async markQuestionAsUsed(question: string, part: 1 | 2 | 3): Promise<void> {
    try {
      const usedQuestions = await this.getUsedQuestions();
      const key = `${part}:${question.toLowerCase().trim()}`;

      if (!usedQuestions.includes(key)) {
        usedQuestions.push(key);
        await AsyncStorage.setItem(
          USED_QUESTIONS_KEY,
          JSON.stringify(usedQuestions)
        );
        console.log("✅ Question marked as used:", key);
      }
    } catch (error) {
      logger.warn("❌ Failed to mark question as used:", error);
    }
  }

  /**
   * Get list of used questions
   */
  async getUsedQuestions(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(USED_QUESTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.warn("❌ Failed to get used questions:", error);
      return [];
    }
  }

  /**
   * Check if a question has been used
   */
  async isQuestionUsed(question: string, part: 1 | 2 | 3): Promise<boolean> {
    try {
      const usedQuestions = await this.getUsedQuestions();
      const key = `${part}:${question.toLowerCase().trim()}`;
      return usedQuestions.includes(key);
    } catch (error) {
      logger.warn("❌ Failed to check if question used:", error);
      return false;
    }
  }

  /**
   * Unmark a question (for retry)
   */
  async unmarkQuestion(question: string, part: 1 | 2 | 3): Promise<void> {
    try {
      const usedQuestions = await this.getUsedQuestions();
      const key = `${part}:${question.toLowerCase().trim()}`;
      const filtered = usedQuestions.filter((q) => q !== key);
      await AsyncStorage.setItem(USED_QUESTIONS_KEY, JSON.stringify(filtered));
      console.log("✅ Question unmarked:", key);
    } catch (error) {
      logger.warn("❌ Failed to unmark question:", error);
    }
  }

  /**
   * Clear used questions (for retry or reset)
   */
  async clearUsedQuestions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USED_QUESTIONS_KEY);
      console.log("✅ Used questions cleared");
    } catch (error) {
      logger.warn("❌ Failed to clear used questions:", error);
    }
  }

  /**
   * Get count of used questions by part
   */
  async getUsedQuestionsCount(): Promise<{
    part1: number;
    part2: number;
    part3: number;
  }> {
    try {
      const usedQuestions = await this.getUsedQuestions();
      return {
        part1: usedQuestions.filter((q) => q.startsWith("1:")).length,
        part2: usedQuestions.filter((q) => q.startsWith("2:")).length,
        part3: usedQuestions.filter((q) => q.startsWith("3:")).length,
      };
    } catch (error) {
      logger.warn("❌ Failed to get used questions count:", error);
      return { part1: 0, part2: 0, part3: 0 };
    }
  }
}

export const resultsStorage = new ResultsStorageService();
