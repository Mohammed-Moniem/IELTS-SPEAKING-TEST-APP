/**
 * Offline Storage Service
 * Handles caching and queueing for offline functionality
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { logger } from "../utils/logger";

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
      logger.warn("❌ Failed to queue evaluation:", error);
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
      logger.warn("❌ Failed to get queued evaluations:", error);
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
      logger.warn("❌ Failed to remove from queue:", error);
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
      logger.warn("❌ Failed to cache topics:", error);
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
      logger.warn("❌ Failed to get cached topics:", error);
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
      logger.warn("❌ Failed to save offline recording:", error);
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
      logger.warn("❌ Failed to get offline recordings:", error);
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
      logger.warn("❌ Failed to remove offline recording:", error);
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
        logger.warn(`❌ Failed to process queued item: ${item.id}`, error);
        // Keep in queue for retry later
      }
    }

    await this.updateLastSync();
    console.log(
      `📊 Queue processing complete: ${successCount} success, ${failedCount} failed`
    );

    return { success: successCount, failed: failedCount };
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      logger.warn("❌ Failed to update last sync:", error);
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
      logger.warn("❌ Failed to get last sync:", error);
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
      logger.warn("❌ Failed to clear cache:", error);
    }
  }

  /**
   * Clear all data (including queue)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.KEYS.QUEUED_EVALUATIONS,
        this.KEYS.CACHED_TOPICS,
        this.KEYS.OFFLINE_RECORDINGS,
        this.KEYS.LAST_SYNC,
      ]);
      console.log("✅ Cleared all offline data");
    } catch (error) {
      logger.warn("❌ Failed to clear all data:", error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    queuedEvaluations: number;
    cachedTopics: number;
    offlineRecordings: number;
    lastSync: number | null;
  }> {
    const [queue, topics, recordings, lastSync] = await Promise.all([
      this.getQueuedEvaluations(),
      this.getCachedTopics(),
      this.getOfflineRecordings(),
      this.getLastSync(),
    ]);

    return {
      queuedEvaluations: queue.length,
      cachedTopics: topics.length,
      offlineRecordings: recordings.length,
      lastSync,
    };
  }
}

export default new OfflineStorageService();
