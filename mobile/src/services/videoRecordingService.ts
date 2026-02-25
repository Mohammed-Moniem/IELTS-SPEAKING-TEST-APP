import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { apiClient, API_KEY } from "../api/client";
import type { UploadResult } from "./api/mediaUploadService";
import { logger } from "../utils/logger";

/**
 * Video metadata interface
 */
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  size: number;
  thumbnail?: string;
}

/**
 * Upload progress callback
 */
export interface UploadProgress {
  percentage: number;
  loaded: number;
  total: number;
}

/**
 * Video Recording Service
 * Handles video recording, picking, compression, thumbnail generation, and upload
 */
class VideoRecordingService {
  private readonly MAX_VIDEO_DURATION = 180; // 3 minutes in seconds
  private readonly MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

  /**
   * Request camera and media library permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Request camera permission
      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== "granted") {
        console.warn("Camera permission denied");
        return false;
      }

      // Request media library permission
      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaPermission.status !== "granted") {
        console.warn("Media library permission denied");
        return false;
      }

      return true;
    } catch (error) {
      logger.warn("Error requesting permissions:", error);
      return false;
    }
  }

  /**
   * Record a video using camera
   */
  async recordVideo(): Promise<ImagePicker.ImagePickerAsset | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("Camera permission not granted");
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8, // Good balance between quality and size
        videoMaxDuration: this.MAX_VIDEO_DURATION,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const video = result.assets[0];

      // Check video size
      if (video.fileSize && video.fileSize > this.MAX_VIDEO_SIZE) {
        throw new Error(
          `Video too large. Max size is ${
            this.MAX_VIDEO_SIZE / (1024 * 1024)
          }MB`
        );
      }

      return video;
    } catch (error) {
      logger.warn("Error recording video:", error);
      throw error;
    }
  }

  /**
   * Pick a video from gallery
   */
  async pickVideo(): Promise<ImagePicker.ImagePickerAsset | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("Media library permission not granted");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: this.MAX_VIDEO_DURATION,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const video = result.assets[0];

      // Check video size
      if (video.fileSize && video.fileSize > this.MAX_VIDEO_SIZE) {
        throw new Error(
          `Video too large. Max size is ${
            this.MAX_VIDEO_SIZE / (1024 * 1024)
          }MB`
        );
      }

      return video;
    } catch (error) {
      logger.warn("Error picking video:", error);
      throw error;
    }
  }

  /**
   * Generate thumbnail for video
   */
  async generateThumbnail(videoUri: string): Promise<string> {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0, // Get first frame
        quality: 0.7,
      });
      return uri;
    } catch (error) {
      logger.warn("Error generating thumbnail:", error);
      throw error;
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(
    video: ImagePicker.ImagePickerAsset
  ): Promise<VideoMetadata> {
    try {
      // Generate thumbnail
      const thumbnail = await this.generateThumbnail(video.uri);

      return {
        duration: (video.duration || 0) * 1000,
        width: video.width || 0,
        height: video.height || 0,
        size: video.fileSize || 0,
        thumbnail,
      };
    } catch (error) {
      logger.warn("Error getting video metadata:", error);
      throw error;
    }
  }

  /**
   * Upload video to server
   */
  async uploadVideo(
    videoUri: string,
    thumbnailUri: string | undefined,
    metadata: VideoMetadata,
    conversationId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Create FormData
      const formData = new FormData();

      // Add video file
      const videoFileName = videoUri.split("/").pop() || "video.mp4";
      const videoType = this.getVideoMimeType(videoFileName);

      formData.append("file", {
        uri: Platform.OS === "ios" ? videoUri.replace("file://", "") : videoUri,
        type: videoType,
        name: videoFileName,
      } as any);

      // Add metadata (backend will generate thumbnail automatically)
      formData.append("conversationId", conversationId);
      formData.append("messageType", "video");
      if (metadata.duration) {
        formData.append("duration", metadata.duration.toString());
      }
      if (metadata.width) {
        formData.append("width", metadata.width.toString());
      }
      if (metadata.height) {
        formData.append("height", metadata.height.toString());
      }

      // Upload with progress tracking using apiClient
      const response = await apiClient.post("/chat/upload", formData, {
        headers: {
          "x-api-key": API_KEY,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentage = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress({
              percentage,
              loaded: progressEvent.loaded,
              total: progressEvent.total,
            });
          }
        },
      });

      const result: UploadResult = response.data.data;
      if (!result.thumbnailUrl && thumbnailUri) {
        result.thumbnailUrl = thumbnailUri;
      }

      return result;
    } catch (error) {
      logger.warn("Error uploading video:", error);
      throw error;
    }
  }

  /**
   * Send video message
   * Note: The actual message sending is handled by the backend after upload
   * This method focuses on video processing and upload
   */
  async sendVideoMessage(
    video: ImagePicker.ImagePickerAsset,
    conversationId: string,
    receiverId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const metadata = await this.getVideoMetadata(video);

      // Upload video (backend will create the message)
      const result = await this.uploadVideo(
        video.uri,
        metadata.thumbnail,
        metadata,
        conversationId,
        onProgress
      );

      return result;
    } catch (error) {
      logger.warn("Error sending video message:", error);
      throw error;
    }
  }

  /**
   * Get video MIME type from filename
   */
  private getVideoMimeType(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "mp4":
        return "video/mp4";
      case "mov":
        return "video/quicktime";
      case "avi":
        return "video/x-msvideo";
      case "mkv":
        return "video/x-matroska";
      case "webm":
        return "video/webm";
      default:
        return "video/mp4";
    }
  }

  /**
   * Format duration for display (MM:SS)
   */
  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// Export singleton instance
export const videoRecordingService = new VideoRecordingService();
export default videoRecordingService;
