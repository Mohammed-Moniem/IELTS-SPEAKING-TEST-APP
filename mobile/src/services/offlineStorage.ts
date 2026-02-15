/**
 * Offline Storage Service
 * Handles caching and queueing for offline functionality
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

interface QueuedEvaluation {
  id: string;
  audioUri: string;
  topicId: string;
  sessionId: string;
  timestamp: number;
  metadata?: {
    topicTitle?: string;
    question?: string;
    duration?: number;
  };
}

interface QueuedPracticeTextCompletion {
  id: string;
  sessionId: string;
  userResponse: string;
  timeSpent?: number;
  timestamp: number;
}

interface QueuedSimulationCompletion {
  id: string;
  simulationId: string;
  parts: Array<{
    part: number;
    question: string;
    response?: string;
    timeSpent?: number;
  }>;
  timestamp: number;
}

interface CachedTopic {
  _id: string;
  title: string;
  slug: string;
  part: number;
  category: string;
  difficulty: string;
  questions: string[];
  tips?: string[];
  cachedAt: number;
}

interface OfflineRecording {
  id: string;
  sessionId: string;
  audioUri: string;
  transcript?: string;
  duration?: number;
  createdAt: number;
}

class OfflineStorageService {
  private KEYS = {
    QUEUED_EVALUATIONS: "queued_evaluations",
    QUEUED_PRACTICE_TEXT: "queued_practice_text_completions",
    QUEUED_SIMULATION_COMPLETIONS: "queued_simulation_completions",
    CACHED_TOPICS: "cached_topics",
    OFFLINE_RECORDINGS: "offline_recordings",
    LAST_SYNC: "last_sync_timestamp",
  };

  private CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  /**
   * Queue evaluation for upload when online
   */
  async queueEvaluation(data: QueuedEvaluation): Promise<void> {
    try {
      const queue = await this.getQueuedEvaluations();
      queue.push(data);
      await AsyncStorage.setItem(
        this.KEYS.QUEUED_EVALUATIONS,
        JSON.stringify(queue)
      );
      console.log("✅ Queued evaluation:", data.id);
    } catch (error) {
      console.error("❌ Failed to queue evaluation:", error);
      throw error;
    }
  }

  /**
   * Get all queued evaluations
   */
  async getQueuedEvaluations(): Promise<QueuedEvaluation[]> {
    try {
      const data = await AsyncStorage.getItem(this.KEYS.QUEUED_EVALUATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("❌ Failed to get queued evaluations:", error);
      return [];
    }
  }

  /**
   * Remove evaluation from queue
   */
  async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueuedEvaluations();
      const filtered = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(
        this.KEYS.QUEUED_EVALUATIONS,
        JSON.stringify(filtered)
      );
      console.log("✅ Removed from queue:", id);
    } catch (error) {
      console.error("❌ Failed to remove from queue:", error);
    }
  }

  /**
   * Cache topics for offline use
   */
  async cacheTopics(topics: any[]): Promise<void> {
    try {
      const cachedTopics: CachedTopic[] = topics.map((topic) => ({
        ...topic,
        cachedAt: Date.now(),
      }));

      await AsyncStorage.setItem(
        this.KEYS.CACHED_TOPICS,
        JSON.stringify(cachedTopics)
      );
      console.log(`✅ Cached ${topics.length} topics`);
    } catch (error) {
      console.error("❌ Failed to cache topics:", error);
    }
  }

  /**
   * Get cached topics (removes stale cache)
   */
  async getCachedTopics(): Promise<CachedTopic[]> {
    try {
      const data = await AsyncStorage.getItem(this.KEYS.CACHED_TOPICS);
      if (!data) return [];

      const topics: CachedTopic[] = JSON.parse(data);
      const now = Date.now();

      // Filter out stale cached topics (older than CACHE_DURATION)
      const validTopics = topics.filter(
        (topic) => now - topic.cachedAt < this.CACHE_DURATION
      );

      // Update cache if we filtered any
      if (validTopics.length !== topics.length) {
        await AsyncStorage.setItem(
          this.KEYS.CACHED_TOPICS,
          JSON.stringify(validTopics)
        );
      }

      return validTopics;
    } catch (error) {
      console.error("❌ Failed to get cached topics:", error);
      return [];
    }
  }

  /**
   * Save offline recording
   */
  async saveOfflineRecording(recording: OfflineRecording): Promise<void> {
    try {
      const recordings = await this.getOfflineRecordings();
      recordings.push(recording);
      await AsyncStorage.setItem(
        this.KEYS.OFFLINE_RECORDINGS,
        JSON.stringify(recordings)
      );
      console.log("✅ Saved offline recording:", recording.id);
    } catch (error) {
      console.error("❌ Failed to save offline recording:", error);
      throw error;
    }
  }

  /**
   * Get all offline recordings
   */
  async getOfflineRecordings(): Promise<OfflineRecording[]> {
    try {
      const data = await AsyncStorage.getItem(this.KEYS.OFFLINE_RECORDINGS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("❌ Failed to get offline recordings:", error);
      return [];
    }
  }

  /**
   * Remove offline recording
   */
  async removeOfflineRecording(id: string): Promise<void> {
    try {
      const recordings = await this.getOfflineRecordings();
      const filtered = recordings.filter((rec) => rec.id !== id);
      await AsyncStorage.setItem(
        this.KEYS.OFFLINE_RECORDINGS,
        JSON.stringify(filtered)
      );
      console.log("✅ Removed offline recording:", id);
    } catch (error) {
      console.error("❌ Failed to remove offline recording:", error);
    }
  }

  async queuePracticeTextCompletion(data: QueuedPracticeTextCompletion): Promise<void> {
    try {
      const queue = await this.getQueuedPracticeTextCompletions();
      queue.push(data);
      await AsyncStorage.setItem(this.KEYS.QUEUED_PRACTICE_TEXT, JSON.stringify(queue));
      console.log("✅ Queued practice completion:", data.id);
    } catch (error) {
      console.error("❌ Failed to queue practice completion:", error);
      throw error;
    }
  }

  async getQueuedPracticeTextCompletions(): Promise<QueuedPracticeTextCompletion[]> {
    try {
      const data = await AsyncStorage.getItem(this.KEYS.QUEUED_PRACTICE_TEXT);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("❌ Failed to get queued practice completions:", error);
      return [];
    }
  }

  async removePracticeTextCompletion(id: string): Promise<void> {
    try {
      const queue = await this.getQueuedPracticeTextCompletions();
      const filtered = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(this.KEYS.QUEUED_PRACTICE_TEXT, JSON.stringify(filtered));
      console.log("✅ Removed queued practice completion:", id);
    } catch (error) {
      console.error("❌ Failed to remove queued practice completion:", error);
    }
  }

  async queueSimulationCompletion(data: QueuedSimulationCompletion): Promise<void> {
    try {
      const queue = await this.getQueuedSimulationCompletions();
      queue.push(data);
      await AsyncStorage.setItem(this.KEYS.QUEUED_SIMULATION_COMPLETIONS, JSON.stringify(queue));
      console.log("✅ Queued simulation completion:", data.id);
    } catch (error) {
      console.error("❌ Failed to queue simulation completion:", error);
      throw error;
    }
  }

  async getQueuedSimulationCompletions(): Promise<QueuedSimulationCompletion[]> {
    try {
      const data = await AsyncStorage.getItem(this.KEYS.QUEUED_SIMULATION_COMPLETIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("❌ Failed to get queued simulation completions:", error);
      return [];
    }
  }

  async removeSimulationCompletion(id: string): Promise<void> {
    try {
      const queue = await this.getQueuedSimulationCompletions();
      const filtered = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(this.KEYS.QUEUED_SIMULATION_COMPLETIONS, JSON.stringify(filtered));
      console.log("✅ Removed queued simulation completion:", id);
    } catch (error) {
      console.error("❌ Failed to remove queued simulation completion:", error);
    }
  }

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  }

  /**
   * Process queue when back online
   */
  async processQueue(
    uploadCallback: (item: QueuedEvaluation) => Promise<void>
  ): Promise<{ success: number; failed: number }> {
    const isConnected = await this.isOnline();

    if (!isConnected) {
      console.log("📡 Still offline, skipping queue processing");
      return { success: 0, failed: 0 };
    }

    const queue = await this.getQueuedEvaluations();
    console.log(`📤 Processing ${queue.length} queued items...`);

    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        await uploadCallback(item);
        await this.removeFromQueue(item.id);
        successCount++;
        console.log(`✅ Processed queued item: ${item.id}`);
      } catch (error) {
        failedCount++;
        console.error(`❌ Failed to process queued item: ${item.id}`, error);
        // Keep in queue for retry later
      }
    }

    await this.updateLastSync();
    console.log(
      `📊 Queue processing complete: ${successCount} success, ${failedCount} failed`
    );

    return { success: successCount, failed: failedCount };
  }

  async processPracticeTextQueue(
    callback: (item: QueuedPracticeTextCompletion) => Promise<void>
  ): Promise<{ success: number; failed: number }> {
    const isConnected = await this.isOnline();
    if (!isConnected) return { success: 0, failed: 0 };

    const queue = await this.getQueuedPracticeTextCompletions();
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        await callback(item);
        await this.removePracticeTextCompletion(item.id);
        successCount++;
      } catch (error) {
        failedCount++;
      }
    }

    await this.updateLastSync();
    return { success: successCount, failed: failedCount };
  }

  async processSimulationCompletionQueue(
    callback: (item: QueuedSimulationCompletion) => Promise<void>
  ): Promise<{ success: number; failed: number }> {
    const isConnected = await this.isOnline();
    if (!isConnected) return { success: 0, failed: 0 };

    const queue = await this.getQueuedSimulationCompletions();
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        await callback(item);
        await this.removeSimulationCompletion(item.id);
        successCount++;
      } catch (error) {
        failedCount++;
      }
    }

    await this.updateLastSync();
    return { success: successCount, failed: failedCount };
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error("❌ Failed to update last sync:", error);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(this.KEYS.LAST_SYNC);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error("❌ Failed to get last sync:", error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.KEYS.CACHED_TOPICS,
        this.KEYS.OFFLINE_RECORDINGS,
      ]);
      console.log("✅ Cleared cache");
    } catch (error) {
      console.error("❌ Failed to clear cache:", error);
    }
  }

  /**
   * Clear all data (including queue)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.KEYS.QUEUED_EVALUATIONS,
        this.KEYS.QUEUED_PRACTICE_TEXT,
        this.KEYS.QUEUED_SIMULATION_COMPLETIONS,
        this.KEYS.CACHED_TOPICS,
        this.KEYS.OFFLINE_RECORDINGS,
        this.KEYS.LAST_SYNC,
      ]);
      console.log("✅ Cleared all offline data");
    } catch (error) {
      console.error("❌ Failed to clear all data:", error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    queuedEvaluations: number;
    queuedPracticeTextCompletions: number;
    queuedSimulationCompletions: number;
    totalQueued: number;
    cachedTopics: number;
    offlineRecordings: number;
    lastSync: number | null;
  }> {
    const [queue, practiceText, simulationCompletions, topics, recordings, lastSync] = await Promise.all([
      this.getQueuedEvaluations(),
      this.getQueuedPracticeTextCompletions(),
      this.getQueuedSimulationCompletions(),
      this.getCachedTopics(),
      this.getOfflineRecordings(),
      this.getLastSync(),
    ]);

    const totalQueued = queue.length + practiceText.length + simulationCompletions.length;
    return {
      queuedEvaluations: queue.length,
      queuedPracticeTextCompletions: practiceText.length,
      queuedSimulationCompletions: simulationCompletions.length,
      totalQueued,
      cachedTopics: topics.length,
      offlineRecordings: recordings.length,
      lastSync,
    };
  }
}

export default new OfflineStorageService();
