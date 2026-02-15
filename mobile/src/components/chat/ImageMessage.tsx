import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_IMAGE_WIDTH = SCREEN_WIDTH * 0.65; // 65% of screen width
const MAX_IMAGE_HEIGHT = 300;

interface ImageMessageProps {
  mediaUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  uploadProgress?: number;
  uploadError?: string;
  onPress?: () => void;
  isOwnMessage: boolean;
  headers?: Record<string, string>;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({
  mediaUrl,
  thumbnailUrl,
  width: originalWidth,
  height: originalHeight,
  uploadProgress,
  uploadError,
  onPress,
  isOwnMessage,
  headers,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Calculate display dimensions while maintaining aspect ratio
  const calculateDimensions = () => {
    if (!originalWidth || !originalHeight) {
      return { width: MAX_IMAGE_WIDTH, height: 200 };
    }

    const aspectRatio = originalWidth / originalHeight;
    let displayWidth = MAX_IMAGE_WIDTH;
    let displayHeight = displayWidth / aspectRatio;

    // If height exceeds max, scale down
    if (displayHeight > MAX_IMAGE_HEIGHT) {
      displayHeight = MAX_IMAGE_HEIGHT;
      displayWidth = displayHeight * aspectRatio;
    }

    return {
      width: Math.round(displayWidth),
      height: Math.round(displayHeight),
    };
  };

  const dimensions = calculateDimensions();
  const imageSource = thumbnailUrl || mediaUrl;
  const isUploading = uploadProgress !== undefined && uploadProgress < 100;
  const hasError = !!uploadError || imageError;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isUploading || hasError}
      activeOpacity={0.8}
      style={[
        styles.container,
        { width: dimensions.width, height: dimensions.height },
      ]}
    >
      {/* Image */}
      {!hasError && (
        <Image
          source={{ uri: imageSource, headers }}
          style={[
            styles.image,
            { width: dimensions.width, height: dimensions.height },
          ]}
          resizeMode="cover"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
      )}

      {/* Loading overlay */}
      {imageLoading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Upload progress overlay */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadProgressContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.uploadProgressText}>{uploadProgress}%</Text>
          </View>
        </View>
      )}

      {/* Error state */}
      {hasError && (
        <View
          style={[
            styles.errorContainer,
            { width: dimensions.width, height: dimensions.height },
            isOwnMessage
              ? styles.errorContainerOwn
              : styles.errorContainerOther,
          ]}
        >
          <Ionicons name="alert-circle" size={40} color="#FF3B30" />
          <Text style={styles.errorText}>
            {uploadError || "Failed to load image"}
          </Text>
        </View>
      )}

      {/* Tap to view indicator (bottom right) */}
      {!isUploading && !hasError && !imageLoading && (
        <View style={styles.tapIndicator}>
          <Ionicons name="expand" size={16} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E0E0E0",
    position: "relative",
  },
  image: {
    borderRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  uploadProgressContainer: {
    alignItems: "center",
  },
  uploadProgressText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    padding: 16,
  },
  errorContainerOwn: {
    backgroundColor: "#DCF8C6",
  },
  errorContainerOther: {
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  tapIndicator: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
});
