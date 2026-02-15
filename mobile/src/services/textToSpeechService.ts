import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { Alert } from "react-native";

import { synthesizeSpeech } from "../api/speechApi";
import { audioCacheService } from "./audioCacheService";

/**
 * Text-to-Speech Service for Spokio (IELTS Speaking)
 * Provides natural-sounding examiner voice
 * Now with pre-cached audio for repetitive phrases
 */

interface TTSOptions {
  rate?: number;
  pitch?: number;
  language?: string;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

class TextToSpeechService {
  private isSpeaking = false;
  private currentUtterance: string | null = null;
  private currentSound: Audio.Sound | null = null;
  private currentAudioFileUri: string | null = null;
  private playbackCompletion: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;
  private stopRequested = false;
  private currentCallbacks: Pick<
    TTSOptions,
    "onDone" | "onStopped" | "onError"
  > | null = null;
  private readonly cacheTtlMs = 1000 * 60 * 60 * 12; // 12 hours
  private readonly maxCacheEntries = 32;
  private audioCache = new Map<
    string,
    { dataUri: string; expiresAt: number }
  >();
  private remoteSynthesisDisabled = false;
  private remoteDisableReason: string | null = null;
  private remoteDisableAlertShown = false;
  private isUsingSystemSpeech = false;

  /**
   * Get part-specific introduction from the examiner
   */
  getPartIntroduction(part: 1 | 2 | 3): string {
    switch (part) {
      case 1:
        return "Good morning. Good afternoon. I'm your examiner for today's IELTS Speaking test. In this part, I'd like to ask you some general questions about yourself and a range of familiar topics. Let's begin.";

      case 2:
        return "Now, I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.";

      case 3:
        return "We've been talking about your topic, and I'd like to discuss some more general questions related to this. Let's consider some broader issues.";

      default:
        return "Let's begin the speaking test.";
    }
  }

  /**
   * Speak text with natural voice through LOUDSPEAKER
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const trimmed = text?.trim();
    if (!trimmed) {
      return;
    }

    if (this.isSpeaking) {
      await this.stop();
    }

    this.isSpeaking = true;
    this.currentUtterance = trimmed;
    this.stopRequested = false;
    this.currentCallbacks = {
      onDone: options.onDone,
      onStopped: options.onStopped,
      onError: options.onError,
    };

    let playbackError: Error | null = null;

    try {
      await this.configureAudioMode();

      console.log("🔊 Speaking:", trimmed.substring(0, 50) + "...");

      if (this.remoteSynthesisDisabled) {
        await this.speakWithSystemVoice(trimmed);
      } else {
        const audioDataUri = await this.getAudioDataUri(trimmed);

        if (this.stopRequested) {
          return;
        }

        await this.playDataUri(audioDataUri);
      }
    } catch (error: any) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      const isBillingIssue =
        (error as any)?.code === "ELEVENLABS_BILLING" ||
        normalizedError.message
          .toLowerCase()
          .includes("premium examiner voice");

      if (isBillingIssue) {
        this.disableRemoteSynthesis(normalizedError.message);
        try {
          await this.speakWithSystemVoice(trimmed);
          playbackError = null;
        } catch (fallbackError: any) {
          playbackError =
            fallbackError instanceof Error
              ? fallbackError
              : new Error(String(fallbackError));
        }
      } else {
        playbackError = normalizedError;
      }

      if (playbackError && !this.stopRequested) {
        console.error("❌ Speech playback error:", playbackError);
      }
    } finally {
      const wasStopped = this.stopRequested;
      await this.cleanupPlayback();

      this.isSpeaking = false;
      this.currentUtterance = null;

      if (playbackError && !wasStopped) {
        this.currentCallbacks?.onError?.(playbackError);
      } else if (wasStopped) {
        this.currentCallbacks?.onStopped?.();
      } else if (!playbackError) {
        console.log("✅ Speech completed");
        this.currentCallbacks?.onDone?.();
      }

      this.currentCallbacks = null;
      const shouldThrow = playbackError && !wasStopped;
      this.stopRequested = false;

      if (shouldThrow && playbackError) {
        throw playbackError;
      }
    }
  }

  /**
   * Speak the part introduction and then the question
   */
  async speakIntroductionAndQuestion(
    part: 1 | 2 | 3,
    question: string,
    onComplete?: () => void
  ): Promise<void> {
    try {
      const introduction = this.getPartIntroduction(part);

      // Speak introduction first
      await this.speak(introduction);

      // Wait a bit before asking the question
      await this.delay(1000);

      // Speak the question
      await this.speak(question, {
        onDone: onComplete,
      });
    } catch (error) {
      console.error("Failed to speak introduction and question:", error);
      throw error;
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    this.stopRequested = true;

    if (!this.currentSound) {
      if (this.isUsingSystemSpeech) {
        Speech.stop();
        this.isUsingSystemSpeech = false;
      }
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.log("🛑 Speech stopped (idle)");
      return;
    }

    try {
      await this.currentSound.stopAsync();
    } catch (error) {
      console.error("Failed to stop speech playback:", error);
    } finally {
      this.playbackCompletion?.resolve();
    }

    if (this.isUsingSystemSpeech) {
      Speech.stop();
      this.isUsingSystemSpeech = false;
    }
  }

  /**
   * Check if currently speaking
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get available voices (platform-dependent)
   */
  async getAvailableVoices() {
    return [
      {
        id: "elevenlabs-default",
        name: "IELTS Examiner (ElevenLabs)",
        language: "en-GB",
      },
    ];
  }

  /**
   * Speak examiner's closing remarks
   */
  async speakClosing(part: 1 | 2 | 3): Promise<void> {
    const closingRemarks = {
      1: "Thank you. That's the end of Part 1.",
      2: "Thank you. That's the end of Part 2.",
      3: "Thank you. That's the end of the speaking test.",
    };

    await this.speak(closingRemarks[part]);
  }

  /**
   * Speak transition to evaluation
   */
  async speakEvaluationTransition(): Promise<void> {
    const messages = [
      "Alright, let me evaluate your response.",
      "Thank you. Now proceeding to evaluate your performance.",
      "Okay, moving on to your evaluation.",
    ];

    // Pick a random transition message
    const message = messages[Math.floor(Math.random() * messages.length)];
    await this.speak(message);
  }

  private async configureAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.warn("⚠️ Failed to configure audio mode for TTS:", error);
    }
  }

  private async getAudioDataUri(text: string): Promise<string> {
    // First, try to get pre-cached audio by matching exact text
    const cachedFileUri = await audioCacheService.getCachedAudioByText(text);

    if (cachedFileUri) {
      console.log("♻️ Using pre-cached audio file");
      // Read cached file and convert to data URI
      try {
        const base64Audio = await FileSystem.readAsStringAsync(cachedFileUri, {
          encoding: "base64",
        });
        return `data:audio/mpeg;base64,${base64Audio}`;
      } catch (error) {
        console.warn(
          "⚠️ Failed to read cached audio, falling back to live TTS:",
          error
        );
        // Fallback to live TTS if cached file read fails
      }
    }

    // Fallback: Check in-memory cache for recently synthesized audio
    const cacheKey = `tts_${text.substring(0, 50)}`;

    this.pruneExpiredCache();

    const cached = this.audioCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log("♻️ Using in-memory cached TTS audio");
      return cached.dataUri;
    }

    // Last resort: Synthesize via backend API
    console.log("🔊 Synthesizing via backend API (no cache available)");
    const dataUri = await synthesizeSpeech(text);

    const expiresAt = Date.now() + this.cacheTtlMs;
    this.audioCache.set(cacheKey, { dataUri, expiresAt });
    this.enforceCacheLimit();

    return dataUri;
  }

  private async speakWithSystemVoice(text: string): Promise<void> {
    this.isUsingSystemSpeech = true;
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        language: "en-US",
        rate: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: (err) =>
          reject(
            err instanceof Error ? err : new Error(String(err ?? "Speech error"))
          ),
      });
    }).finally(() => {
      this.isUsingSystemSpeech = false;
    });
  }

  private disableRemoteSynthesis(reason?: string) {
    if (this.remoteSynthesisDisabled) {
      return;
    }
    this.remoteSynthesisDisabled = true;
    this.remoteDisableReason =
      reason || "Premium voice is temporarily unavailable.";
    console.warn("⚠️ Remote TTS disabled:", this.remoteDisableReason);
    if (!this.remoteDisableAlertShown) {
      Alert.alert(
        "Voice unavailable",
        "Our premium examiner voice is temporarily unavailable. We'll continue using the system voice instead."
      );
      this.remoteDisableAlertShown = true;
    }
  }

  private enforceCacheLimit(): void {
    if (this.audioCache.size <= this.maxCacheEntries) {
      return;
    }

    const keys = Array.from(this.audioCache.keys());
    const overflow = this.audioCache.size - this.maxCacheEntries;
    for (let index = 0; index < overflow; index += 1) {
      const key = keys[index];
      if (key) {
        this.audioCache.delete(key);
      }
    }
  }

  private pruneExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.audioCache.entries()) {
      if (value.expiresAt <= now) {
        this.audioCache.delete(key);
      }
    }
  }

  private async playDataUri(dataUri: string): Promise<void> {
    const { sound, fileUri } = await this.prepareSound(dataUri);

    if (this.stopRequested) {
      await sound.unloadAsync().catch(() => null);
      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(
        () => null
      );
      return;
    }

    this.currentSound = sound;
    this.currentAudioFileUri = fileUri;

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      this.playbackCompletion = {
        resolve: () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        },
        reject: (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      };

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          const statusError = (status as any).error as string | undefined;
          if (statusError) {
            this.playbackCompletion?.reject(new Error(statusError));
          }
          return;
        }

        if (status.didJustFinish && !status.isLooping) {
          this.playbackCompletion?.resolve();
        }
      });

      sound.playAsync().catch((error) => {
        this.playbackCompletion?.reject(error as Error);
      });
    });
  }

  private async prepareSound(
    dataUri: string
  ): Promise<{ sound: Audio.Sound; fileUri: string }> {
    const base64Data = this.extractBase64(dataUri);
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error("File system cache directory is not available.");
    }

    const fileUri = `${baseDir}tts-${Date.now()}.mp3`;

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: "base64",
    });

    const sound = new Audio.Sound();
    await sound.loadAsync({ uri: fileUri });

    return { sound, fileUri };
  }

  private extractBase64(dataUri: string): string {
    const parts = dataUri.split(",");
    if (parts.length === 2) {
      return parts[1];
    }
    return dataUri;
  }

  private async cleanupPlayback(): Promise<void> {
    if (this.currentSound) {
      await this.currentSound.unloadAsync().catch(() => null);
      this.currentSound = null;
    }

    if (this.currentAudioFileUri) {
      await FileSystem.deleteAsync(this.currentAudioFileUri, {
        idempotent: true,
      }).catch(() => null);
      this.currentAudioFileUri = null;
    }

    this.playbackCompletion = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const ttsService = new TextToSpeechService();
