/**
 * Audio API Client
 * Handles audio recording upload, retrieval, and management
 */

import { apiClient } from "./client";

export interface AudioRecording {
  id: string;
  sessionId: string;
  recordingType: "practice" | "simulation";
  fileName: string;
  fileSizeBytes: number;
  durationSeconds: number;
  topic?: string;
  testPart?: string;
  overallBand?: number;
  scores?: {
    fluencyCoherence?: number;
    lexicalResource?: number;
    grammaticalRange?: number;
    pronunciation?: number;
  };
  createdAt: string;
  expiresAt?: string;
}

export interface StorageStats {
  totalRecordings: number;
  totalSizeMB: number;
  practiceCount: number;
  simulationCount: number;
  oldestRecording?: string;
  newestRecording?: string;
}

export interface UploadAudioParams {
  audioUri: string;
  userId: string;
  sessionId: string;
  recordingType: "practice" | "simulation";
  durationSeconds: number;
  topic?: string;
  testPart?: string;
  overallBand?: number;
  scores?: {
    fluencyCoherence?: number;
    lexicalResource?: number;
    grammaticalRange?: number;
    pronunciation?: number;
  };
  userTier?: "free" | "premium" | "pro";
}

/**
 * Upload audio recording
 */
export async function uploadAudio(
  params: UploadAudioParams
): Promise<AudioRecording | null> {
  try {
    console.log("📤 Uploading audio recording...");

    // Create FormData
    const formData = new FormData();

    // Add audio file
    const audioFile = {
      uri: params.audioUri,
      type: "audio/mpeg",
      name: `recording_${Date.now()}.mp3`,
    } as any;
    formData.append("audio", audioFile);

    // Add metadata
    formData.append("userId", params.userId);
    formData.append("sessionId", params.sessionId);
    formData.append("recordingType", params.recordingType);
    formData.append("durationSeconds", params.durationSeconds.toString());

    if (params.topic) formData.append("topic", params.topic);
    if (params.testPart) formData.append("testPart", params.testPart);
    if (params.overallBand)
      formData.append("overallBand", params.overallBand.toString());
    if (params.userTier) formData.append("userTier", params.userTier);

    if (params.scores) {
      if (params.scores.fluencyCoherence)
        formData.append(
          "fluencyCoherence",
          params.scores.fluencyCoherence.toString()
        );
      if (params.scores.lexicalResource)
        formData.append(
          "lexicalResource",
          params.scores.lexicalResource.toString()
        );
      if (params.scores.grammaticalRange)
        formData.append(
          "grammaticalRange",
          params.scores.grammaticalRange.toString()
        );
      if (params.scores.pronunciation)
        formData.append(
          "pronunciation",
          params.scores.pronunciation.toString()
        );
    }

    const response = await fetch(`${apiClient.defaults.baseURL}/audio/upload`, {
      method: "POST",
      headers: {
        "x-api-key": apiClient.defaults.headers["x-api-key"],
      },
      body: formData,
    });

    const result = await response.json();

    if (result.success && result.data) {
      console.log("✅ Audio uploaded successfully:", result.data.recordingId);
      return {
        id: result.data.recordingId,
        sessionId: params.sessionId,
        recordingType: params.recordingType,
        fileName: result.data.fileName,
        fileSizeBytes: result.data.fileSizeBytes,
        durationSeconds: result.data.durationSeconds,
        topic: params.topic,
        testPart: params.testPart,
        overallBand: params.overallBand,
        scores: params.scores,
        createdAt: result.data.createdAt,
        expiresAt: result.data.expiresAt,
      };
    } else {
      console.error("❌ Failed to upload audio:", result.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Upload audio error:", error);
    return null;
  }
}

/**
 * List user recordings
 */
export async function listUserRecordings(
  userId: string,
  options?: {
    limit?: number;
    skip?: number;
    recordingType?: "practice" | "simulation";
  }
): Promise<{ recordings: AudioRecording[]; total: number }> {
  try {
    console.log("📋 Fetching user recordings...");

    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.skip) params.append("skip", options.skip.toString());
    if (options?.recordingType)
      params.append("recordingType", options.recordingType);

    const queryString = params.toString();
    const url = `/audio/list/${userId}${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);

    if (response.data.success && response.data.data) {
      console.log(
        `✅ Fetched ${response.data.data.recordings.length} recordings`
      );
      return {
        recordings: response.data.data.recordings,
        total: response.data.data.total,
      };
    } else {
      console.error("❌ Failed to fetch recordings:", response.data.error);
      return { recordings: [], total: 0 };
    }
  } catch (error) {
    console.error("❌ List recordings error:", error);
    return { recordings: [], total: 0 };
  }
}

/**
 * Get audio download URL
 */
export function getAudioUrl(recordingId: string): string {
  return `${apiClient.defaults.baseURL}/audio/${recordingId}`;
}

/**
 * Delete recording
 */
export async function deleteRecording(
  recordingId: string,
  userId: string
): Promise<boolean> {
  try {
    console.log("🗑️  Deleting recording:", recordingId);

    const response = await apiClient.delete(`/audio/${recordingId}`, {
      headers: {
        "x-user-id": userId,
      },
    });

    if (response.data.success) {
      console.log("✅ Recording deleted successfully");
      return true;
    } else {
      console.error("❌ Failed to delete recording:", response.data.error);
      return false;
    }
  } catch (error) {
    console.error("❌ Delete recording error:", error);
    return false;
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(
  userId: string
): Promise<StorageStats | null> {
  try {
    console.log("📊 Fetching storage stats...");

    const response = await apiClient.get(`/audio/stats/${userId}`);

    if (response.data.success && response.data.data) {
      console.log("✅ Storage stats fetched");
      return response.data.data;
    } else {
      console.error("❌ Failed to fetch stats:", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Get storage stats error:", error);
    return null;
  }
}
