import { Ionicons } from "@expo/vector-icons";
import { AVPlaybackStatus } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import audioRecordingService from "../../services/api/audioRecordingService";

interface AudioMessageProps {
  mediaUrl: string;
  duration?: number;
  isOwnMessage: boolean;
  headers?: Record<string, string>;
  uploadProgress?: number;
  uploadError?: string;
  status?: string;
}

export const AudioMessage: React.FC<AudioMessageProps> = ({
  mediaUrl,
  duration = 0,
  isOwnMessage,
  headers,
  uploadProgress,
  uploadError,
  status,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const playbackRef = useRef<string | null>(null);

  const isUploading =
    status === "uploading" ||
    (typeof uploadProgress === "number" && uploadProgress < 100);
  const hasError = status === "failed" || !!uploadError;

  useEffect(() => {
    return () => {
      if (isPlaying) {
        void audioRecordingService.stopAudio();
      }
    };
  }, [isPlaying]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    setCurrentPosition(status.positionMillis ?? 0);

    if (status.durationMillis && audioDuration === 0) {
      setAudioDuration(status.durationMillis);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setCurrentPosition(0);
    }
  };

  const handlePlayPause = async () => {
    if (!mediaUrl) return;

    try {
      if (isPlaying) {
        await audioRecordingService.pauseAudio();
        setIsPlaying(false);
      } else {
        setIsLoading(true);

        if (currentPosition === 0 || playbackRef.current !== mediaUrl) {
          playbackRef.current = mediaUrl;
          await audioRecordingService.playAudio(
            mediaUrl,
            handlePlaybackStatusUpdate,
            headers
          );
        } else {
          await audioRecordingService.resumeAudio();
        }

        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Playback error:", error);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getProgress = (): number => {
    if (audioDuration === 0) return 0;
    return (currentPosition / audioDuration) * 100;
  };

  const displayedDuration =
    isPlaying || currentPosition > 0
      ? currentPosition
      : audioDuration > 0
      ? audioDuration
      : duration;

  return (
    <View
      style={[
        styles.container,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
      ]}
    >
      <View
        style={[styles.tail, isOwnMessage ? styles.ownTail : styles.otherTail]}
      />

      {isUploading && (
        <View pointerEvents="none" style={styles.uploadOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.uploadText}>
            {Math.max(0, Math.round(uploadProgress ?? 0))}%
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        disabled={isLoading || !mediaUrl}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isOwnMessage ? "#000000" : "#128C7E"}
          />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={24}
            color={isOwnMessage ? "#000000" : "#128C7E"}
          />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {Array.from({ length: 30 }).map((_, index) => {
            const barHeight = Math.random() * 16 + 8;
            const progress = getProgress();
            const barProgress = (index / 30) * 100;
            const isActive = barProgress <= progress && !isUploading;

            return (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height: barHeight,
                    backgroundColor: isActive
                      ? isOwnMessage
                        ? "#075E54"
                        : "#128C7E"
                      : "rgba(0, 0, 0, 0.15)",
                  },
                ]}
              />
            );
          })}
        </View>

        <Text style={[styles.duration, isOwnMessage && styles.ownDuration]}>
          {formatTime(displayedDuration)}
        </Text>
      </View>

      <View style={styles.micIcon}>
        <Ionicons
          name="mic"
          size={16}
          color={isOwnMessage ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.3)"}
        />
      </View>

      {hasError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={14} color="#FF3B30" />
          <Text style={styles.errorText}>
            {uploadError || "Upload failed"}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 200,
    maxWidth: 280,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    elevation: 2,
  },
  ownMessage: {
    backgroundColor: "#DCF8C6",
  },
  otherMessage: {
    backgroundColor: "#FFFFFF",
  },
  tail: {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
    bottom: 0,
  },
  ownTail: {
    right: -5,
    borderWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#DCF8C6",
    borderBottomColor: "transparent",
    transform: [{ rotate: "45deg" }],
  },
  otherTail: {
    left: -5,
    borderWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    borderBottomColor: "transparent",
    transform: [{ rotate: "-45deg" }],
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 8,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "column",
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    gap: 2,
    marginBottom: 4,
  },
  waveBar: {
    flex: 1,
    borderRadius: 1,
    minWidth: 2,
  },
  duration: {
    fontSize: 11,
    color: "#667781",
    fontWeight: "500",
  },
  ownDuration: {
    color: "#075E54",
  },
  micIcon: {
    marginLeft: 12,
  },
  errorBanner: {
    position: "absolute",
    bottom: -18,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 11,
  },
});
