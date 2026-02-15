import { Audio } from "expo-av";
import { Recording, RecordingOptions } from "expo-av/build/Audio";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface AudioRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onUploadProgress?: (progress: number) => void;
  maxDuration?: number; // in seconds
  disabled?: boolean;
  testMode?: "practice" | "simulation";
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  onUploadProgress,
  maxDuration = 120, // 2 minutes default
  disabled = false,
  testMode = "practice",
}) => {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<
    "idle" | "recording" | "paused" | "completed"
  >("idle");
  const [duration, setDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveformAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestPermissions();
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (recordingStatus === "recording") {
      startPulseAnimation();
      startWaveformAnimation();
    } else {
      pulseAnim.stopAnimation();
      waveformAnim.stopAnimation();
    }
  }, [recordingStatus]);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (error) {
      console.error("Failed to get audio permissions:", error);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startWaveformAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveformAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(waveformAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startRecording = async () => {
    if (!hasPermission) {
      await requestPermissions();
      return;
    }

    try {
      // If we're recording again, clean up the previous file to avoid cache bloat.
      if (recordingStatus === "completed" && lastRecordingUri) {
        try {
          await FileSystem.deleteAsync(lastRecordingUri, { idempotent: true });
        } catch {
          // Best effort; not fatal.
        } finally {
          setLastRecordingUri(null);
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions: RecordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions
      );

      setRecording(newRecording);
      setRecordingStatus("recording");
      setDuration(0);

      // Update duration every second
      const interval = setInterval(async () => {
        if (newRecording) {
          const status = await newRecording.getStatusAsync();
          if (status.isRecording) {
            const currentDuration = Math.floor(status.durationMillis / 1000);
            setDuration(currentDuration);

            // Auto-stop at max duration
            if (currentDuration >= maxDuration) {
              clearInterval(interval);
              await stopRecording();
            }
          }
        }
      }, 1000);

      // Store interval for cleanup
      (newRecording as any)._updateInterval = interval;
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Failed to start recording. Please check permissions.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsProcessing(true);

      // Clear update interval
      if ((recording as any)._updateInterval) {
        clearInterval((recording as any)._updateInterval);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        // Get file info using updated API or skip if not critical
        let finalDuration = duration;

        try {
          // Try to get file info (not critical if it fails)
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log("Audio file info:", fileInfo);
        } catch (infoError) {
          console.log("Could not get file info (not critical):", infoError);
          // Continue anyway - we have the URI and duration
        }

        setRecordingStatus("completed");
        setLastRecordingUri(uri);
        onRecordingComplete(uri, finalDuration);
      }

      setRecording(null);
      setIsProcessing(false);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsProcessing(false);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    try {
      // Clear update interval
      if ((recording as any)._updateInterval) {
        clearInterval((recording as any)._updateInterval);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Delete the file
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      setRecording(null);
      setRecordingStatus("idle");
      setDuration(0);
    } catch (error) {
      console.error("Failed to cancel recording:", error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getProgress = (): number => {
    return (duration / maxDuration) * 100;
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Microphone permission is required
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermissions}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Recording Status & Timer */}
      <View style={styles.statusContainer}>
        {recordingStatus === "recording" && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording</Text>
          </View>
        )}

        <Text style={styles.timerText}>{formatTime(duration)}</Text>

        {maxDuration && (
          <Text style={styles.maxTimeText}>Max: {formatTime(maxDuration)}</Text>
        )}
      </View>

      {/* Progress Bar */}
      {recordingStatus === "recording" && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${getProgress()}%` }]} />
        </View>
      )}

      {/* Waveform Animation */}
      {recordingStatus === "recording" && (
        <View style={styles.waveformContainer}>
          {[...Array(5)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                {
                  transform: [
                    {
                      scaleY: waveformAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ],
                  opacity: waveformAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Main Record Button */}
      <View style={styles.buttonContainer}>
        {recordingStatus === "idle" || recordingStatus === "completed" ? (
          <TouchableOpacity
            style={[styles.recordButton, disabled && styles.disabledButton]}
            onPress={startRecording}
            disabled={disabled || isProcessing}
          >
            <Animated.View
              style={[
                styles.recordButtonInner,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <View style={styles.micIcon}>
                  <Text style={styles.micIconText}>🎤</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelRecording}
              disabled={isProcessing}
            >
              <Text style={styles.cancelButtonText}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.stopButton, isProcessing && styles.disabledButton]}
              onPress={stopRecording}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.stopIcon} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Instructions */}
      {recordingStatus === "idle" && (
        <Text style={styles.instructionText}>
          {testMode === "practice"
            ? "Tap the microphone to start recording your answer"
            : "Tap to begin speaking test"}
        </Text>
      )}

      {recordingStatus === "recording" && (
        <Text style={styles.instructionText}>
          Speak clearly into your device microphone
        </Text>
      )}

      {recordingStatus === "completed" && (
        <Text style={styles.instructionText}>
          Tap the microphone to record again, or continue when you're ready.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    minHeight: 300,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ef4444",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
  timerText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#1f2937",
    fontVariant: ["tabular-nums"],
  },
  maxTimeText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  progressContainer: {
    width: "100%",
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 30,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    marginBottom: 30,
    gap: 8,
  },
  waveformBar: {
    width: 6,
    height: 50,
    backgroundColor: "#3b82f6",
    borderRadius: 3,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  recordButtonInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  micIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  micIconText: {
    fontSize: 48,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 30,
  },
  cancelButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "700",
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  instructionText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },
  disabledButton: {
    opacity: 0.5,
  },
  permissionContainer: {
    alignItems: "center",
    padding: 30,
  },
  permissionText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
