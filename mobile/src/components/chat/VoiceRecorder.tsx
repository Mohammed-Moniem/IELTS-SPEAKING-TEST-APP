import { Ionicons } from "@expo/vector-icons";
import { AVPlaybackStatus } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import audioRecordingService from "../../services/api/audioRecordingService";
import type { ColorTokens } from "../../theme/tokens";
import { logger } from "../../utils/logger";

interface VoiceRecorderProps {
  onSend: (audioUri: string, duration: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSend,
  onCancel,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  // Animation values for waveform
  const waveAnimations = useRef(
    Array.from({ length: 20 }, () => new Animated.Value(0.3))
  ).current;

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 100);
      }, 100);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording]);

  // Waveform animation
  useEffect(() => {
    if (isRecording) {
      // Animate waveform bars randomly
      const animations = waveAnimations.map((anim) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
          ])
        )
      );

      animations.forEach((anim) => anim.start());

      return () => {
        animations.forEach((anim) => anim.stop());
      };
    } else {
      // Reset all to default
      waveAnimations.forEach((anim) => anim.setValue(0.3));
    }
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      await audioRecordingService.stopAudio();
      await audioRecordingService.startRecording();
      setIsRecording(true);
      setDuration(0);
      setPreviewProgress(0);
      setPreviewDuration(0);
      setIsPreviewPlaying(false);
      setAudioUri(null);
    } catch (error) {
      logger.warn("Failed to start recording", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const handleStopRecording = async () => {
    if (!audioRecordingService.isRecording()) {
      console.warn("No active recording to stop");
      return;
    }
    try {
      const uri = await audioRecordingService.stopRecording();
      setAudioUri(uri);
      setIsRecording(false);
      const recordedDuration = audioRecordingService.getRecordingDuration();
      if (recordedDuration > 0) {
        setDuration(recordedDuration);
        setPreviewDuration(recordedDuration);
      }
      setPreviewProgress(0);
    } catch (error) {
      logger.warn("Failed to stop recording", error);
      Alert.alert("Error", "Failed to stop recording. Please try again.");
    }
  };

  const handleCancel = async () => {
    try {
      if (isRecording) {
        await audioRecordingService.cancelRecording();
      }
      await audioRecordingService.stopAudio();
      setIsRecording(false);
      setDuration(0);
      setAudioUri(null);
      setPreviewDuration(0);
      setPreviewProgress(0);
      setIsPreviewPlaying(false);
      onCancel();
    } catch (error) {
      logger.warn("Failed to cancel recording", error);
      setIsPreviewPlaying(false);
      onCancel();
    }
  };

  const handleSend = async () => {
    if (audioUri) {
      try {
        await audioRecordingService.stopAudio();
      } catch (error) {
        console.warn("Failed to stop preview playback before sending:", error);
      }

      const finalDuration =
        previewDuration > 0 ? previewDuration : duration;

      onSend(audioUri, finalDuration);
      setAudioUri(null);
      setDuration(0);
      setPreviewDuration(0);
      setPreviewProgress(0);
      setIsPreviewPlaying(false);
    }
  };

  const handlePreviewStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    const position = status.positionMillis ?? 0;
    const total =
      status.durationMillis ??
      previewDuration ??
      audioRecordingService.getRecordingDuration() ??
      duration;

    setPreviewProgress(position);
    if (total > 0) {
      setPreviewDuration(total);
    }

    if (status.didJustFinish) {
      setIsPreviewPlaying(false);
      setPreviewProgress(total);
      audioRecordingService.stopAudio().catch((error) => {
        console.warn("Failed to stop preview after completion:", error);
      });
    }
  };

  const handlePreviewPlayPause = async () => {
    if (!audioUri) return;

    try {
      if (isPreviewPlaying) {
        await audioRecordingService.pauseAudio();
        setIsPreviewPlaying(false);
      } else {
        if (previewProgress >= (previewDuration || duration)) {
          await audioRecordingService.stopAudio();
          setPreviewProgress(0);
        }

        await audioRecordingService.playAudio(
          audioUri,
          handlePreviewStatusUpdate
        );
        setIsPreviewPlaying(true);
      }
    } catch (error) {
      logger.warn("Failed to toggle preview playback", error);
      setIsPreviewPlaying(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Start recording automatically on mount
  useEffect(() => {
    handleStartRecording();

    return () => {
      // Cleanup on unmount
      audioRecordingService.cancelRecording();
      audioRecordingService.stopAudio();
    };
  }, []);

  useEffect(() => {
    if (!audioUri) {
      setIsPreviewPlaying(false);
      setPreviewProgress(0);
      setPreviewDuration(0);
    } else {
      const recordedDuration = audioRecordingService.getRecordingDuration();
      if (recordedDuration > 0) {
        setPreviewDuration(recordedDuration);
      }
    }
  }, [audioUri]);

  const displayedDuration = (() => {
    if (audioUri) {
      if (isPreviewPlaying && previewProgress > 0) {
        return previewProgress;
      }
      if (previewProgress > 0) {
        return previewProgress;
      }
      if (previewDuration > 0) {
        return previewDuration;
      }
    }
    return duration;
  })();

  return (
    <View style={styles.container}>
      {/* Slide to cancel hint */}
      <View style={styles.slideHint}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={styles.slideText}>Slide to cancel</Text>
      </View>

      {/* Waveform visualization */}
      <View style={styles.waveformContainer}>
        {waveAnimations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveBar,
              {
                height: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 40],
                }),
                opacity: isRecording ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>

      {/* Duration display */}
      <Text style={styles.duration}>{formatDuration(displayedDuration)}</Text>

      {/* Control buttons */}
      <View style={styles.controls}>
        {/* Cancel button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Ionicons name="close" size={28} color={colors.danger} />
        </TouchableOpacity>

        {/* Record/Stop button */}
        <TouchableOpacity
          style={[styles.recordButton, audioUri && styles.recordButtonStopped]}
          onPress={
            audioUri
              ? handlePreviewPlayPause
              : isRecording
              ? handleStopRecording
              : handleStartRecording
          }
        >
          {audioUri ? (
            isPreviewPlaying ? (
              <Ionicons name="pause" size={28} color={colors.primaryOn} />
            ) : (
              <Ionicons name="play" size={28} color={colors.primaryOn} />
            )
          ) : isRecording ? (
            <View style={styles.stopIcon} />
          ) : (
            <Ionicons name="mic" size={32} color={colors.primaryOn} />
          )}
        </TouchableOpacity>

        {/* Send button (only show after recording) */}
        {audioUri && (
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="checkmark" size={28} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording...</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.surfaceSubtle,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  slideHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  slideText: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    marginBottom: 12,
    gap: 3,
  },
  waveBar: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 1.5,
  },
  duration: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  cancelButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  recordButtonStopped: {
    backgroundColor: colors.primary,
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: colors.primaryOn,
    borderRadius: 4,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginRight: 6,
  },
  recordingText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "500",
  },
});
