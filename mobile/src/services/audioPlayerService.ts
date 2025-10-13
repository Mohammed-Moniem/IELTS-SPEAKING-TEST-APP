/**
 * Audio Player Service
 * Handles audio playback for recorded answers
 */

import { Audio, AVPlaybackStatus } from "expo-av";
import { Sound } from "expo-av/build/Audio";

interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  uri: string | null;
}

type PlaybackCallback = (state: PlaybackState) => void;

class AudioPlayerService {
  private sound: Sound | null = null;
  private currentUri: string | null = null;
  private listeners: Set<PlaybackCallback> = new Set();
  private playbackState: PlaybackState = {
    isPlaying: false,
    isLoading: false,
    position: 0,
    duration: 0,
    uri: null,
  };

  constructor() {
    this.setupAudioMode();
  }

  /**
   * Configure audio session for playback
   */
  private async setupAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      console.log("✅ Audio mode configured for playback");
    } catch (error) {
      console.error("❌ Failed to setup audio mode:", error);
    }
  }

  /**
   * Load and prepare audio for playback
   */
  async loadAudio(uri: string): Promise<boolean> {
    try {
      // If already loaded, just return
      if (this.currentUri === uri && this.sound) {
        return true;
      }

      // Unload previous audio
      await this.unloadAudio();

      this.updateState({ isLoading: true, uri });

      // Load new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      this.currentUri = uri;

      // Get duration
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        this.updateState({
          isLoading: false,
          duration: status.durationMillis || 0,
          position: 0,
        });
      }

      console.log("✅ Audio loaded:", uri);
      return true;
    } catch (error) {
      console.error("❌ Failed to load audio:", error);
      this.updateState({ isLoading: false });
      return false;
    }
  }

  /**
   * Play audio from current position
   */
  async play(): Promise<void> {
    try {
      if (!this.sound) {
        console.warn("⚠️ No audio loaded");
        return;
      }

      await this.sound.playAsync();
      this.updateState({ isPlaying: true });
      console.log("▶️ Playing audio");
    } catch (error) {
      console.error("❌ Failed to play audio:", error);
    }
  }

  /**
   * Pause audio playback
   */
  async pause(): Promise<void> {
    try {
      if (!this.sound) {
        console.warn("⚠️ No audio loaded");
        return;
      }

      await this.sound.pauseAsync();
      this.updateState({ isPlaying: false });
      console.log("⏸️ Audio paused");
    } catch (error) {
      console.error("❌ Failed to pause audio:", error);
    }
  }

  /**
   * Stop and reset audio to beginning
   */
  async stop(): Promise<void> {
    try {
      if (!this.sound) {
        return;
      }

      await this.sound.stopAsync();
      await this.sound.setPositionAsync(0);
      this.updateState({ isPlaying: false, position: 0 });
      console.log("⏹️ Audio stopped");
    } catch (error) {
      console.error("❌ Failed to stop audio:", error);
    }
  }

  /**
   * Seek to specific position (milliseconds)
   */
  async seekTo(positionMillis: number): Promise<void> {
    try {
      if (!this.sound) {
        console.warn("⚠️ No audio loaded");
        return;
      }

      await this.sound.setPositionAsync(positionMillis);
      this.updateState({ position: positionMillis });
      console.log("⏩ Seeked to:", positionMillis);
    } catch (error) {
      console.error("❌ Failed to seek:", error);
    }
  }

  /**
   * Set playback rate (0.5 = half speed, 2.0 = double speed)
   */
  async setRate(rate: number): Promise<void> {
    try {
      if (!this.sound) {
        console.warn("⚠️ No audio loaded");
        return;
      }

      await this.sound.setRateAsync(rate, true);
      console.log("🎚️ Playback rate set to:", rate);
    } catch (error) {
      console.error("❌ Failed to set rate:", error);
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  async setVolume(volume: number): Promise<void> {
    try {
      if (!this.sound) {
        console.warn("⚠️ No audio loaded");
        return;
      }

      const clampedVolume = Math.max(0, Math.min(1, volume));
      await this.sound.setVolumeAsync(clampedVolume);
      console.log("🔊 Volume set to:", clampedVolume);
    } catch (error) {
      console.error("❌ Failed to set volume:", error);
    }
  }

  /**
   * Unload current audio and free resources
   */
  async unloadAudio(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
        this.currentUri = null;
        this.updateState({
          isPlaying: false,
          isLoading: false,
          position: 0,
          duration: 0,
          uri: null,
        });
        console.log("🗑️ Audio unloaded");
      }
    } catch (error) {
      console.error("❌ Failed to unload audio:", error);
    }
  }

  /**
   * Get current playback status
   */
  async getStatus(): Promise<AVPlaybackStatus | null> {
    try {
      if (!this.sound) {
        return null;
      }
      return await this.sound.getStatusAsync();
    } catch (error) {
      console.error("❌ Failed to get status:", error);
      return null;
    }
  }

  /**
   * Subscribe to playback state changes
   */
  subscribe(callback: PlaybackCallback): () => void {
    this.listeners.add(callback);
    // Immediately notify with current state
    callback(this.playbackState);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Check if audio is currently loaded
   */
  isLoaded(): boolean {
    return this.sound !== null;
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.playbackState.isPlaying;
  }

  /**
   * Format milliseconds to MM:SS
   */
  formatTime(millis: number): string {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Playback status update callback
   */
  private onPlaybackStatusUpdate = (status: AVPlaybackStatus): void => {
    if (status.isLoaded) {
      this.updateState({
        isPlaying: status.isPlaying,
        position: status.positionMillis,
        duration: status.durationMillis || 0,
      });

      // Handle playback completion
      if (status.didJustFinish && !status.isLooping) {
        this.updateState({ isPlaying: false, position: 0 });
        console.log("✅ Playback finished");
      }
    } else if (status.error) {
      console.error("❌ Playback error:", status.error);
      this.updateState({ isPlaying: false });
    }
  };

  /**
   * Update internal state and notify listeners
   */
  private updateState(updates: Partial<PlaybackState>): void {
    this.playbackState = {
      ...this.playbackState,
      ...updates,
    };

    // Notify all listeners
    this.listeners.forEach((callback) => {
      callback(this.playbackState);
    });
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.unloadAudio();
    this.listeners.clear();
    console.log("🧹 Audio player destroyed");
  }
}

export default new AudioPlayerService();
