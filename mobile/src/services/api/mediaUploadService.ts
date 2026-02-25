import * as ImagePicker from "expo-image-picker";
import { apiClient, API_KEY } from "../../api/client";
import type { ChatMessage } from "./chatService";
import { logger } from "../../utils/logger";

// Dynamically import react-native-compressor (optional dependency)
let ImageCompressor: any = null;
try {
  const compressorModule = require("react-native-compressor");
  ImageCompressor = compressorModule.Image;
} catch (error) {
  console.warn(
    "react-native-compressor not available - image compression will be skipped. Use a development build for compression support."
  );
}

/**
 * Media types supported by the upload service
 */
export type MediaType = "image" | "audio" | "video" | "file" | "gif";

/**
 * Image picker result with additional metadata
 */
export interface PickedMedia {
  uri: string;
  type: MediaType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number; // For audio/video
}

/**
 * Upload progress callback
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload result from backend
 */
export interface UploadResult {
  fileId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
  };
  message?: ChatMessage;
}

/**
 * Media upload service for handling image, video, audio, and file uploads
 */
class MediaUploadService {
  private uploadProgress: Map<string, UploadProgress> = new Map();

  /**
   * Request camera permissions
   */
  async requestCameraPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      console.warn("Camera permission denied");
      return false;
    }
    return true;
  }

  /**
   * Request media library permissions
   */
  async requestMediaLibraryPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      console.warn("Media library permission denied");
      return false;
    }
    return true;
  }

  /**
   * Pick an image from the gallery
   */
  async pickImageFromGallery(): Promise<PickedMedia | null> {
    try {
      // Request permissions
      const hasPermission = await this.requestMediaLibraryPermissions();
      if (!hasPermission) {
        throw new Error("Media library permission required");
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8, // Initial quality, will be compressed further
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];

      // Determine file name
      const fileName = asset.uri.split("/").pop() || `image_${Date.now()}.jpg`;

      // Determine if it's a GIF
      const isGif =
        asset.uri.toLowerCase().endsWith(".gif") ||
        (asset.mimeType && asset.mimeType.includes("gif"));

      return {
        uri: asset.uri,
        type: isGif ? "gif" : "image",
        fileName,
        fileSize: asset.fileSize || 0,
        mimeType: asset.mimeType || "image/jpeg",
        width: asset.width,
        height: asset.height,
      };
    } catch (error) {
      logger.warn("Error picking image from gallery:", error);
      throw error;
    }
  }

  /**
   * Take a photo with the camera
   */
  async takePhoto(): Promise<PickedMedia | null> {
    try {
      // Request permissions
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        throw new Error("Camera permission required");
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];

      const fileName = `photo_${Date.now()}.jpg`;

      return {
        uri: asset.uri,
        type: "image",
        fileName,
        fileSize: asset.fileSize || 0,
        mimeType: "image/jpeg",
        width: asset.width,
        height: asset.height,
      };
    } catch (error) {
      logger.warn("Error taking photo:", error);
      throw error;
    }
  }

  /**
   * Compress an image to reduce file size
   */
  async compressImage(uri: string): Promise<string> {
    try {
      // Skip compression for GIFs to preserve animation
      if (uri.toLowerCase().endsWith(".gif")) {
        return uri;
      }

      // Skip compression if compressor not available (e.g., in Expo Go)
      if (!ImageCompressor) {
        console.log("Image compression skipped - compressor not available");
        return uri;
      }

      const compressedUri = await ImageCompressor.compress(uri, {
        compressionMethod: "auto",
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
      });

      return compressedUri;
    } catch (error) {
      logger.warn("Error compressing image:", error);
      // Return original URI if compression fails
      return uri;
    }
  }

  /**
   * Upload media to the backend
   */
  async uploadMedia(
    media: PickedMedia,
    conversationId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      let uploadUri = media.uri;

      // Compress images before upload (except GIFs)
      if (media.type === "image") {
        uploadUri = await this.compressImage(media.uri);
      }

      // Create form data
      const formData = new FormData();

      // Add file
      formData.append("file", {
        uri: uploadUri,
        type: media.mimeType,
        name: media.fileName,
      } as any);

      // Add metadata
      formData.append("conversationId", conversationId);
      formData.append("messageType", media.type);

      if (media.width) formData.append("width", media.width.toString());
      if (media.height) formData.append("height", media.height.toString());
      if (media.duration)
        formData.append("duration", media.duration.toString());

      // Upload with progress tracking
      const uploadId = `upload_${Date.now()}`;

      const response = await apiClient.post("/chat/upload", formData, {
        headers: {
          "x-api-key": API_KEY,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress: UploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              ),
            };

            this.uploadProgress.set(uploadId, progress);

            if (onProgress) {
              onProgress(progress);
            }
          }
        },
      });

      // Clean up progress tracking
      this.uploadProgress.delete(uploadId);

      return response.data.data;
    } catch (error) {
      logger.warn("Error uploading media:", error);
      throw error;
    }
  }

  /**
   * Send an image message
   */
  async sendImageMessage(
    conversationId: string,
    media: PickedMedia,
    caption?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Upload the media first
      const uploadResult = await this.uploadMedia(
        media,
        conversationId,
        onProgress
      );

      // The backend will automatically create a message with the uploaded media
      // No need to send a separate message creation request

      return uploadResult;
    } catch (error) {
      logger.warn("Error sending image message:", error);
      throw error;
    }
  }

  /**
   * Download a media file
   * Note: For now, we'll use the mediaUrl directly.
   * In production, you can implement proper caching with expo-file-system
   */
  async downloadMedia(mediaUrl: string, fileName: string): Promise<string> {
    try {
      // For now, just return the media URL
      // The Image component can handle network URLs directly
      return mediaUrl;
    } catch (error) {
      logger.warn("Error downloading media:", error);
      throw error;
    }
  }

  /**
   * Get upload progress for a specific upload
   */
  getUploadProgress(uploadId: string): UploadProgress | null {
    return this.uploadProgress.get(uploadId) || null;
  }

  /**
   * Cancel all ongoing uploads (cleanup)
   */
  clearUploadProgress(): void {
    this.uploadProgress.clear();
  }

  /**
   * Validate media file size
   */
  validateFileSize(fileSize: number, maxSizeMB: number = 25): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

export default new MediaUploadService();
