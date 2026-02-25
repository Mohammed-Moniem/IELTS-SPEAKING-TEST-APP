import { apiClient } from "./client";
import { logger } from "../utils/logger";

export interface GeneratedTopic {
  questionId?: string;
  question: string;
  category: "part1" | "part2" | "part3";
  difficulty: "easy" | "medium" | "hard";
  keywords: string[];
  followUpQuestions?: string[];
  cueCard?: {
    mainTopic: string;
    bulletPoints: string[];
    timeToSpeak: number;
    preparationTime: number;
  };
}

/**
 * Get a random topic for practice
 */
export const getRandomTopic = async (
  category: "part1" | "part2" | "part3",
  difficulty: "easy" | "medium" | "hard" = "medium"
): Promise<GeneratedTopic> => {
  try {
    console.log(
      `🎯 Getting random topic: category=${category}, difficulty=${difficulty}`
    );

    const response = await apiClient.get(`/topics/get-random`, {
      params: {
        category,
        difficulty,
      },
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to get random topic");
    }

    console.log(
      "✅ Random topic received:",
      response.data.data.question.substring(0, 50) + "..."
    );
    return response.data.data;
  } catch (error) {
    logger.warn("❌ Get random topic error:", error);
    throw error;
  }
};

/**
 * Generate multiple topics
 */
export const generateTopics = async (
  category: "part1" | "part2" | "part3",
  count: number = 5,
  difficulty: "easy" | "medium" | "hard" = "medium",
  excludeKeywords: string[] = []
): Promise<GeneratedTopic[]> => {
  try {
    console.log(`🎯 Generating ${count} topics for ${category}`);

    const response = await apiClient.post("/topics/generate", {
      category,
      count,
      difficulty,
      excludeKeywords,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to generate topics");
    }

    console.log(`✅ Generated ${response.data.data.topics.length} topics`);
    return response.data.data.topics;
  } catch (error) {
    logger.warn("❌ Generate topics error:", error);
    throw error;
  }
};

/**
 * Get list of common IELTS topics
 */
export const getCommonTopics = async (
  category: "part1" | "part2" | "part3"
): Promise<string[]> => {
  try {
    console.log(`📚 Getting common topics for ${category}`);

    const response = await apiClient.get("/topics/common", {
      params: { category },
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to get common topics");
    }

    console.log(
      `✅ Retrieved ${response.data.data.topics.length} common topics`
    );
    return response.data.data.topics;
  } catch (error) {
    logger.warn("❌ Get common topics error:", error);
    throw error;
  }
};

/**
 * Cache for topics to avoid regenerating too frequently
 */
class TopicCache {
  private cache: Map<string, { topics: GeneratedTopic[]; timestamp: number }> =
    new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  get(
    category: "part1" | "part2" | "part3",
    difficulty: string,
    usedQuestions: string[] = []
  ): GeneratedTopic | null {
    const key = `${category}-${difficulty}`;
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    // Filter out used questions
    const availableTopics = cached.topics.filter((topic) => {
      const questionKey = `${category.replace("part", "")}:${topic.question
        .toLowerCase()
        .trim()}`;
      return !usedQuestions.includes(questionKey);
    });

    // Return random topic from available topics
    if (availableTopics.length === 0) {
      console.log(
        "⚠️ All cached topics have been used, need to fetch new ones"
      );
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableTopics.length);
    return availableTopics[randomIndex];
  }

  set(
    category: "part1" | "part2" | "part3",
    difficulty: string,
    topics: GeneratedTopic[]
  ) {
    const key = `${category}-${difficulty}`;
    this.cache.set(key, {
      topics,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const topicCache = new TopicCache();

/**
 * Get random topic with caching and avoiding used questions
 */
export const getCachedRandomTopic = async (
  category: "part1" | "part2" | "part3",
  difficulty: "easy" | "medium" | "hard" = "medium",
  usedQuestions: string[] = []
): Promise<GeneratedTopic> => {
  // Try to get from cache first (excluding used questions)
  const cached = topicCache.get(category, difficulty, usedQuestions);
  if (cached) {
    console.log("✅ Using cached topic (unused)");
    return cached;
  }

  // If not in cache or all cached topics used, get new topics
  console.log("📥 Cache miss or all topics used, getting new random topic...");

  try {
    // Use the faster /topics/random endpoint instead of generating
    const topic = await getRandomTopic(category, difficulty);

    // Check if this topic was already used
    const questionKey = `${category.replace("part", "")}:${topic.question
      .toLowerCase()
      .trim()}`;
    const isUsed = usedQuestions.includes(questionKey);

    if (isUsed) {
      console.log("⚠️ Received a used topic, generating batch instead...");
      // If the random topic is used, generate a batch to increase chances of unused topics
      const topics = await generateTopics(category, 10, difficulty);
      topicCache.set(category, difficulty, topics);

      // Try to find an unused topic from the batch
      const unusedTopic = topics.find((t) => {
        const key = `${category.replace("part", "")}:${t.question
          .toLowerCase()
          .trim()}`;
        return !usedQuestions.includes(key);
      });

      if (unusedTopic) {
        return unusedTopic;
      } else {
        console.log("⚠️ All generated topics have been used, returning anyway");
        return topics[0];
      }
    }

    // Cache it for future use
    topicCache.set(category, difficulty, [topic]);

    return topic;
  } catch (error) {
    logger.warn("Failed to get random topic, falling back to generation");
    // Fallback: generate batch if random endpoint fails
    const topics = await generateTopics(category, 10, difficulty);
    topicCache.set(category, difficulty, topics);

    // Try to find an unused topic
    const unusedTopic = topics.find((t) => {
      const key = `${category.replace("part", "")}:${t.question
        .toLowerCase()
        .trim()}`;
      return !usedQuestions.includes(key);
    });

    return unusedTopic || topics[0];
  }
};
