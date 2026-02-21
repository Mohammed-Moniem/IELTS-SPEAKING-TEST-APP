import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import videoRecordingService from "../../services/videoRecordingService";
import { VideoPlayer } from "./VideoPlayer";

interface VideoMessageProps {
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  isOwnMessage: boolean;
  timestamp: Date;
  isLoading?: boolean;
  headers?: Record<string, string>;
}

/**
 * Video message component for chat
 * Displays video thumbnail with play button, opens full-screen player on tap
 */
export const VideoMessage: React.FC<VideoMessageProps> = ({
  videoUrl,
  thumbnailUrl,
  duration = 0,
  width = 16,
  height = 9,
  isOwnMessage,
  timestamp,
  isLoading = false,
  headers,
}) => {
  const [playerVisible, setPlayerVisible] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);

  // Calculate thumbnail dimensions (maintain aspect ratio, max 250x250)
  const MAX_SIZE = 250;
  const aspectRatio = width / height;
  let thumbnailWidth = MAX_SIZE;
  let thumbnailHeight = MAX_SIZE;

  if (aspectRatio > 1) {
    // Landscape
    thumbnailHeight = MAX_SIZE / aspectRatio;
  } else {
    // Portrait
    thumbnailWidth = MAX_SIZE * aspectRatio;
  }

  const handlePress = () => {
    if (!isLoading && videoUrl) {
      setPlayerVisible(true);
    }
  };

  const formatTime = (
    hours: number,
    minutes: number,
    seconds: number
  ): string => {
    const time = new Date(timestamp);
    return time.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <View
          style={[
            styles.thumbnailContainer,
            { width: thumbnailWidth, height: thumbnailHeight },
          ]}
        >
          {/* Thumbnail image */}
          {thumbnailUrl && (
            <Image
              source={{ uri: thumbnailUrl, headers }}
              style={styles.thumbnail}
              onLoadStart={() => setThumbnailLoading(true)}
              onLoadEnd={() => setThumbnailLoading(false)}
            />
          )}

          {/* Loading overlay */}
          {(isLoading || thumbnailLoading) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Play button overlay */}
          {!isLoading && !thumbnailLoading && (
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={32} color="#FFFFFF" />
              </View>
            </View>
          )}

          {/* Duration badge */}
          {duration > 0 && (
            <View style={styles.durationBadge}>
              <Ionicons name="videocam" size={12} color="#FFFFFF" />
              <Text style={styles.durationText}>
                {videoRecordingService.formatDuration(duration)}
              </Text>
            </View>
          )}
        </View>

        {/* Timestamp */}
        <View style={styles.footer}>
          <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
            {formatTime(0, 0, 0)}
          </Text>
          {isOwnMessage && (
            <Ionicons
              name="checkmark-done"
              size={16}
              color="#34B7F1"
              style={styles.readReceipt}
            />
          )}
        </View>

        {/* WhatsApp-style tail */}
        <View
          style={[
            styles.tail,
            isOwnMessage ? styles.ownTail : styles.otherTail,
          ]}
        />
      </TouchableOpacity>

      {/* Full-screen video player */}
      {playerVisible && (
        <VideoPlayer
          videoUri={videoUrl}
          thumbnailUri={thumbnailUrl}
          visible={playerVisible}
          headers={headers}
          onClose={() => setPlayerVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: "75%",
    borderRadius: 12,
    padding: 4,
    marginVertical: 2,
    position: "relative",
  },
  ownMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#DCF8C6",
    marginRight: 8,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    marginLeft: 8,
  },
  thumbnailContainer: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E5E5E5",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: "#667781",
  },
  ownTimestamp: {
    color: "#667781",
  },
  readReceipt: {
    marginLeft: 4,
  },
  tail: {
    position: "absolute",
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
  },
  ownTail: {
    right: -8,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderBottomWidth: 0,
    borderLeftColor: "#DCF8C6",
    borderRightColor: "transparent",
    borderTopColor: "#DCF8C6",
    borderBottomColor: "transparent",
  },
  otherTail: {
    left: -8,
    borderLeftWidth: 0,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderBottomWidth: 0,
    borderLeftColor: "transparent",
    borderRightColor: "#FFFFFF",
    borderTopColor: "#FFFFFF",
    borderBottomColor: "transparent",
  },
});

export default VideoMessage;
