/**
 * Audio Cache Service
 * Pre-caches repetitive examiner phrases to optimize test loading performance
 * Downloads and stores common TTS audio on first app launch
 */

import * as FileSystem from "expo-file-system/legacy";
import { synthesizeSpeech } from "../api/speechApi";

interface CachedPhrase {
  id: string;
  text: string;
  fileUri: string;
  expiresAt: number;
}

interface CacheMetadata {
  version: string;
  phrases: Record<string, CachedPhrase>;
  lastUpdated: number;
}

/**
 * Common examiner phrases that repeat across all tests
 * These will be pre-cached to eliminate loading delays
 */
const REPETITIVE_PHRASES = [
  {
    id: "welcome_intro",
    text: "Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?",
  },
  {
    id: "id_check",
    text: "Thank you. Could you please show me your identification document?",
  },
  {
    id: "part1_begin",
    text: "Thank you. Let's begin with Part 1 of the test.",
  },
  {
    id: "part1_transition",
    text: "Thank you. That's the end of Part 1. Now let's move on to Part 2.",
  },
  {
    id: "part2_intro",
    text: "Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say.",
  },
  {
    id: "part2_begin_speaking",
    text: "Please begin speaking now.",
  },
  {
    id: "part2_transition",
    text: "Thank you. That's the end of Part 2.",
  },
  {
    id: "part3_intro",
    text: "Thank you. Now we'll move on to Part 3, where I'll ask you some more abstract questions.",
  },
  {
    id: "test_complete",
    text: "Thank you for your responses. That's the end of the speaking test. Please allow me a moment to evaluate your progress.",
  },
];

class AudioCacheService {
  private cacheDir: string;
  private metadataFile: string;
  private cacheVersion = "1.0.0";
  private cacheTTLDays = 30; // Cache expires after 30 days
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error("File system directory is not available");
    }
    this.cacheDir = `${baseDir}audio-cache/`;
    this.metadataFile = `${this.cacheDir}metadata.json`;
  }

  /**
   * Initialize cache directory and load metadata
   */
  private async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, {
          intermediates: true,
        });
        console.log("📁 Created audio cache directory");
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize audio cache:", error);
      throw error;
    }
  }

  /**
   * Ensure initialization happens only once
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.init();
    }

    await this.initializationPromise;
  }

  /**
   * Load cache metadata from disk
   */
  private async loadMetadata(): Promise<CacheMetadata | null> {
    try {
      await this.ensureInitialized();

      const fileInfo = await FileSystem.getInfoAsync(this.metadataFile);
      if (!fileInfo.exists) {
        return null;
      }

      const content = await FileSystem.readAsStringAsync(this.metadataFile);
      const metadata: CacheMetadata = JSON.parse(content);

      // Check if cache version matches
      if (metadata.version !== this.cacheVersion) {
        console.log("🔄 Cache version mismatch, clearing cache");
        await this.clearCache();
        return null;
      }

      return metadata;
    } catch (error) {
      console.error("❌ Failed to load cache metadata:", error);
      return null;
    }
  }

  /**
   * Save cache metadata to disk
   */
  private async saveMetadata(metadata: CacheMetadata): Promise<void> {
    try {
      await this.ensureInitialized();
      await FileSystem.writeAsStringAsync(
        this.metadataFile,
        JSON.stringify(metadata, null, 2)
      );
    } catch (error) {
      console.error("❌ Failed to save cache metadata:", error);
    }
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(metadata: CacheMetadata): boolean {
    const now = Date.now();
    const expiryTime =
      metadata.lastUpdated + this.cacheTTLDays * 24 * 60 * 60 * 1000;
    return now > expiryTime;
  }

  /**
   * Download and cache a single phrase
   */
  private async cachePhrase(
    phraseId: string,
    text: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<string> {
    try {
      // Synthesize speech using backend API
      const audioDataUri = await synthesizeSpeech(text);

      // Extract base64 data
      const base64Data = audioDataUri.split(",")[1] || audioDataUri;

      // Save to cache directory
      const fileName = `${phraseId}.mp3`;
      const fileUri = `${this.cacheDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: "base64",
      });

      console.log(`✅ Cached phrase: ${phraseId}`);
      return fileUri;
    } catch (error) {
      console.error(`❌ Failed to cache phrase ${phraseId}:`, error);
      throw error;
    }
  }

  /**
   * Pre-cache all repetitive phrases
   * This should be called on first app launch or when cache is expired
   */
  async preCacheAllPhrases(
    onProgress?: (current: number, total: number, phraseId: string) => void
  ): Promise<void> {
    try {
      await this.ensureInitialized();

      console.log("🚀 Starting audio pre-caching...");

      // Load existing metadata
      const existingMetadata = await this.loadMetadata();

      // Check if cache is valid
      if (
        existingMetadata &&
        !this.isCacheExpired(existingMetadata) &&
        Object.keys(existingMetadata.phrases).length ===
          REPETITIVE_PHRASES.length
      ) {
        console.log("✅ Audio cache is up to date");
        return;
      }

      // Clear expired cache
      if (existingMetadata && this.isCacheExpired(existingMetadata)) {
        console.log("🗑️ Clearing expired cache");
        await this.clearCache();
      }

      const newMetadata: CacheMetadata = {
        version: this.cacheVersion,
        phrases: {},
        lastUpdated: Date.now(),
      };

      // Cache each phrase
      const total = REPETITIVE_PHRASES.length;
      for (let i = 0; i < REPETITIVE_PHRASES.length; i++) {
        const phrase = REPETITIVE_PHRASES[i];

        onProgress?.(i + 1, total, phrase.id);

        const fileUri = await this.cachePhrase(phrase.id, phrase.text);

        newMetadata.phrases[phrase.id] = {
          id: phrase.id,
          text: phrase.text,
          fileUri,
          expiresAt: Date.now() + this.cacheTTLDays * 24 * 60 * 60 * 1000,
        };

        // Small delay to avoid overwhelming the backend
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Save metadata
      await this.saveMetadata(newMetadata);

      console.log("✅ Audio pre-caching complete");
    } catch (error) {
      console.error("❌ Audio pre-caching failed:", error);
      throw error;
    }
  }

  /**
   * Get cached audio URI for a specific phrase ID
   * Returns null if not cached, allowing fallback to live TTS
   */
  async getCachedAudio(phraseId: string): Promise<string | null> {
    try {
      await this.ensureInitialized();

      const metadata = await this.loadMetadata();
      if (!metadata) {
        return null;
      }

      const cachedPhrase = metadata.phrases[phraseId];
      if (!cachedPhrase) {
        return null;
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(cachedPhrase.fileUri);
      if (!fileInfo.exists) {
        console.warn(`⚠️ Cached audio file missing: ${phraseId}`);
        return null;
      }

      // Check if expired
      if (Date.now() > cachedPhrase.expiresAt) {
        console.log(`⏰ Cached audio expired: ${phraseId}`);
        return null;
      }

      console.log(`♻️ Using cached audio: ${phraseId}`);
      return cachedPhrase.fileUri;
    } catch (error) {
      console.error(`❌ Failed to get cached audio for ${phraseId}:`, error);
      return null;
    }
  }

  /**
   * Get cached audio by matching exact text
   * Useful when phrase ID is not available
   */
  async getCachedAudioByText(text: string): Promise<string | null> {
    try {
      const trimmedText = text.trim();

      // Find matching phrase
      const matchingPhrase = REPETITIVE_PHRASES.find(
        (p) => p.text.trim() === trimmedText
      );

      if (!matchingPhrase) {
        return null;
      }

      return await this.getCachedAudio(matchingPhrase.id);
    } catch (error) {
      console.error("❌ Failed to get cached audio by text:", error);
      return null;
    }
  }

  /**
   * Check if cache needs updating
   */
  async needsCacheUpdate(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const metadata = await this.loadMetadata();
      if (!metadata) {
        return true;
      }

      // Check if expired
      if (this.isCacheExpired(metadata)) {
        return true;
      }

      // Check if all phrases are cached
      if (Object.keys(metadata.phrases).length !== REPETITIVE_PHRASES.length) {
        return true;
      }

      // Check if all files exist
      for (const phraseId in metadata.phrases) {
        const cachedPhrase = metadata.phrases[phraseId];
        const fileInfo = await FileSystem.getInfoAsync(cachedPhrase.fileUri);
        if (!fileInfo.exists) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("❌ Failed to check cache status:", error);
      return true;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    isCached: boolean;
    cachedCount: number;
    totalCount: number;
    lastUpdated: Date | null;
    expiresAt: Date | null;
  }> {
    try {
      await this.ensureInitialized();

      const metadata = await this.loadMetadata();
      if (!metadata) {
        return {
          isCached: false,
          cachedCount: 0,
          totalCount: REPETITIVE_PHRASES.length,
          lastUpdated: null,
          expiresAt: null,
        };
      }

      const expiryTime =
        metadata.lastUpdated + this.cacheTTLDays * 24 * 60 * 60 * 1000;

      return {
        isCached: !this.isCacheExpired(metadata),
        cachedCount: Object.keys(metadata.phrases).length,
        totalCount: REPETITIVE_PHRASES.length,
        lastUpdated: new Date(metadata.lastUpdated),
        expiresAt: new Date(expiryTime),
      };
    } catch (error) {
      console.error("❌ Failed to get cache stats:", error);
      return {
        isCached: false,
        cachedCount: 0,
        totalCount: REPETITIVE_PHRASES.length,
        lastUpdated: null,
        expiresAt: null,
      };
    }
  }

  /**
   * Clear all cached audio files and metadata
   */
  async clearCache(): Promise<void> {
    try {
      await this.ensureInitialized();

      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
        await FileSystem.makeDirectoryAsync(this.cacheDir, {
          intermediates: true,
        });
      }

      console.log("🗑️ Audio cache cleared");
    } catch (error) {
      console.error("❌ Failed to clear cache:", error);
    }
  }

  /**
   * Get all available phrase IDs
   */
  getAvailablePhraseIds(): string[] {
    return REPETITIVE_PHRASES.map((p) => p.id);
  }

  /**
   * Get phrase text by ID
   */
  getPhraseText(phraseId: string): string | null {
    const phrase = REPETITIVE_PHRASES.find((p) => p.id === phraseId);
    return phrase ? phrase.text : null;
  }
}

// Export singleton instance
export const audioCacheService = new AudioCacheService();
export { REPETITIVE_PHRASES };
