import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { API_KEY, apiClient, getAuthToken } from "../../api/client";
import type { UploadProgress, UploadResult } from "./mediaUploadService";

/**
 * Recording state
 */
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // in milliseconds
  uri: string | null;
}

/**
 * Audio playback state
 */
export interface PlaybackState {
  isPlaying: boolean;
  duration: number; // in milliseconds
  position: number; // in milliseconds
}

/**
 * Audio recording service for voice notes
 */
class AudioRecordingService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private recordingDuration: number = 0;
  private durationInterval: NodeJS.Timeout | null = null;

  /**
   * Request audio recording permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("Audio recording permission denied");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error requesting audio permissions:", error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("Audio recording permission required");
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.recordingDuration = 0;

      // Start duration timer
      this.durationInterval = setInterval(() => {
        this.recordingDuration += 100;
      }, 100);

      console.log("Recording started");
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  }

  /**
   * Stop recording and get the audio file
   */
  async stopRecording(): Promise<string> {
    try {
      if (!this.recording) {
        throw new Error("No active recording");
      }

      // Clear duration timer
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }

      // Stop recording
      await this.recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        throw new Error("Failed to get recording URI");
      }

      console.log("Recording stopped, URI:", uri);
      return uri;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      throw error;
    }
  }

  /**
   * Cancel recording without saving
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.recording) {
        // Clear duration timer
        if (this.durationInterval) {
          clearInterval(this.durationInterval);
          this.durationInterval = null;
        }

        await this.recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
        this.recording = null;
        this.recordingDuration = 0;
        console.log("Recording cancelled");
      }
    } catch (error) {
      console.error("Failed to cancel recording:", error);
      throw error;
    }
  }

  /**
   * Get current recording duration
   */
  getRecordingDuration(): number {
    return this.recordingDuration;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Upload audio recording
   */
  async uploadAudio(
    uri: string,
    conversationId: string,
    duration: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      console.log("🎤 uploadAudio called with:", {
        uri,
        conversationId,
        duration,
      });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log("📁 File info:", fileInfo);

      if (!fileInfo.exists) {
        throw new Error("Audio file not found");
      }

      // Create form data
      const formData = new FormData();

      // Add the audio file (backend expects 'file' field)
      // Keep the full URI - React Native will handle it
      formData.append("file", {
        uri: uri,
        type: "audio/m4a",
        name: `voice_${Date.now()}.m4a`,
      } as any);

      // Add metadata
      formData.append("conversationId", conversationId);
      formData.append("messageType", "audio");
      formData.append("duration", duration.toString());

      console.log(
        "📤 Uploading audio with FormData parts:",
        (formData as any)._parts
      );

      // Use fetch instead of axios to avoid Content-Type issues
      const baseURL = apiClient.defaults.baseURL || "";
      const uploadUrl = `${baseURL}/chat/upload`;

      console.log("🌐 Uploading to:", uploadUrl);

      // Get auth token
      const token = getAuthToken();
      console.log("🔐 Auth token:", token ? "present" : "missing");

      const headers: Record<string, string> = {
        "x-api-key": API_KEY,
        Accept: "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log("📤 Fetch upload with headers:", headers);

      let response;
      try {
        response = await fetch(uploadUrl, {
          method: "POST",
          headers,
          body: formData,
        });

        console.log(
          "📡 Response status:",
          response.status,
          response.statusText
        );
      } catch (fetchError) {
        console.error("❌ Fetch failed:", fetchError);
        console.error("📍 URL was:", uploadUrl);
        console.error("📋 FormData parts:", (formData as any)._parts);
        console.error("🔍 Fetch error type:", fetchError?.constructor?.name);
        console.error(
          "🔍 Fetch error message:",
          fetchError instanceof Error ? fetchError.message : String(fetchError)
        );
        throw new Error(
          `Network request failed: ${
            fetchError instanceof Error ? fetchError.message : "Unknown error"
          }`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload failed:", response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      let responseData;
      try {
        responseData = await response.json();
        console.log("✅ Upload successful:", responseData);
      } catch (jsonError) {
        console.error("❌ Failed to parse response JSON:", jsonError);
        const responseText = await response.text();
        console.error("📄 Response text:", responseText);
        throw new Error(
          `Invalid JSON response: ${
            jsonError instanceof Error ? jsonError.message : "Unknown error"
          }`
        );
      }

      // Return data in expected UploadResult format
      return responseData.data;
    } catch (error) {
      console.error("❌ Upload error details:", error);
      if (
        error instanceof Error &&
        error.message.includes("Network request failed")
      ) {
        console.error("💡 This usually means:");
        console.error("  1. ngrok URL is incorrect or expired");
        console.error("  2. Backend is not accessible from mobile");
        console.error("  3. CORS or network connectivity issue");
      }
      throw error;
    }
  }

  /**
   * Send an audio message (record, upload, and send)
   */
  async sendAudioMessage(
    conversationId: string,
    audioUri: string,
    duration: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const uploadResult = await this.uploadAudio(
        audioUri,
        conversationId,
        duration,
        onProgress
      );
      return uploadResult;
    } catch (error) {
      console.error("Error sending audio message:", error);
      throw error;
    }
  }

  /**
   * Play audio file
   */
  async playAudio(
    uri: string,
    onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void,
    headers?: Record<string, string>
  ): Promise<void> {
    try {
      // Unload previous sound if exists
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Load and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri, headers },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      this.sound = sound;
      await sound.playAsync();
    } catch (error) {
      console.error("Error playing audio:", error);
      throw error;
    }
  }

  /**
   * Pause audio playback
   */
  async pauseAudio(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.pauseAsync();
      }
    } catch (error) {
      console.error("Error pausing audio:", error);
      throw error;
    }
  }

  /**
   * Resume audio playback
   */
  async resumeAudio(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.playAsync();
      }
    } catch (error) {
      console.error("Error resuming audio:", error);
      throw error;
    }
  }

  /**
   * Stop audio playback
   */
  async stopAudio(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.error("Error stopping audio:", error);
      throw error;
    }
  }

  /**
   * Seek to position in audio
   */
  async seekAudio(positionMillis: number): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.setPositionAsync(positionMillis);
      }
    } catch (error) {
      console.error("Error seeking audio:", error);
      throw error;
    }
  }

  /**
   * Get audio playback status
   */
  async getPlaybackStatus(): Promise<AVPlaybackStatus | null> {
    try {
      if (this.sound) {
        return await this.sound.getStatusAsync();
      }
      return null;
    } catch (error) {
      console.error("Error getting playback status:", error);
      return null;
    }
  }

  /**
   * Format duration in MM:SS format
   */
  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.recording) {
        await this.cancelRecording();
      }
      if (this.sound) {
        await this.stopAudio();
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

export default new AudioRecordingService();
