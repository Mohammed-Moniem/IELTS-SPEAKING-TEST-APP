import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { practiceApi } from "../../api/services";
import { AudioRecorder } from "../../components/AudioRecorder";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ProfileMenu } from "../../components/ProfileMenu";
import { ScreenContainer } from "../../components/ScreenContainer";
import { Tag } from "../../components/Tag";
import { useTheme } from "../../context";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useNotificationManager } from "../../hooks/useNotificationManager";
import { useThemedStyles } from "../../hooks";
import { PracticeStackParamList } from "../../navigation/PracticeNavigator";
import offlineStorage from "../../services/offlineStorage";
import type { ColorTokens } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";
import { PracticeSessionStart } from "../../types/api";
import { extractErrorMessage } from "../../utils/errors";

export type PracticeSessionScreenProps = NativeStackScreenProps<
  PracticeStackParamList,
  "PracticeSession"
>;

const buildSessionTitle = (session: PracticeSessionStart) =>
  `${session.topic.title} • Part ${session.topic.part}`;

export const PracticeSessionScreen: React.FC<PracticeSessionScreenProps> = ({
  route,
  navigation,
}) => {
  const { trackPracticeSession, notifyFeedbackReady } =
    useNotificationManager();
  const { session: initialSession } = route.params;
  const queryClient = useQueryClient();
  const { isOffline, isOnline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [response, setResponse] = useState("");
  const [useAudio, setUseAudio] = useState(true); // Default to audio mode
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState("");

  const startTimeRef = useRef(Date.now());
  const session = useMemo(() => initialSession, [initialSession]);

  // Add header with profile icon
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <ProfileMenu />,
    });
  }, [navigation]);

  // Process queued items when coming back online
  useEffect(() => {
    if (isOnline) {
      offlineStorage
        .processQueue(async (item) => {
          // Upload the queued audio
          await practiceApi.uploadAudio(
            item.sessionId,
            item.audioUri,
            () => {} // No progress callback for background sync
          );
        })
        .then((result) => {
          if (result.success > 0) {
            console.log(`✅ Synced ${result.success} recordings`);
          }
        })
        .catch(console.error);
    }
  }, [isOnline]);

  const completeSessionMutation = useMutation({
    mutationFn: (payload: { userResponse: string; timeSpent?: number }) =>
      practiceApi.completeSession(session.sessionId, payload),
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: ["practice-sessions"] })
        .catch(() => undefined);

      // Track practice session for notifications
      trackPracticeSession().catch(console.error);

      Alert.alert(
        "Session completed",
        "Feedback will be available in your history."
      );
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Unable to complete session", extractErrorMessage(error));
    },
  });

  const uploadAudioMutation = useMutation({
    mutationFn: (uri: string) =>
      practiceApi.uploadAudio(session.sessionId, uri, setUploadProgress),
    onSuccess: (data) => {
      queryClient
        .invalidateQueries({ queryKey: ["practice-sessions"] })
        .catch(() => undefined);

      // Track practice session for notifications
      trackPracticeSession().catch(console.error);

      // Notify when feedback is ready
      notifyFeedbackReady(buildSessionTitle(session)).catch(console.error);

      // Show transcription if available
      if (data.transcription?.text) {
        setTranscriptionText(data.transcription.text);
      }

      Alert.alert(
        "Recording submitted!",
        data.transcription?.text
          ? "Your answer has been transcribed and evaluated. Check your history for feedback."
          : "Your audio has been submitted for evaluation. Feedback will be available shortly.",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Upload failed", extractErrorMessage(error));
      setUploadProgress(0);
    },
  });

  const handleRecordingComplete = (uri: string, duration: number) => {
    setAudioUri(uri);
    setAudioDuration(duration);
  };

  const handleSubmitAudio = async () => {
    if (!audioUri) {
      Alert.alert("No recording", "Please record your answer first.");
      return;
    }

    // If offline, queue the recording
    if (isOffline) {
      try {
        await offlineStorage.queueEvaluation({
          id: `${session.sessionId}-${Date.now()}`,
          audioUri,
          topicId: session.topic.slug,
          sessionId: session.sessionId,
          timestamp: Date.now(),
          metadata: {
            topicTitle: session.topic.title,
            question: session.question,
            duration: audioDuration,
          },
        });

        Alert.alert(
          "Recording saved",
          "Your recording has been saved and will be uploaded when you're back online.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } catch (error) {
        Alert.alert(
          "Failed to save",
          "Could not save your recording. Please try again."
        );
      }
      return;
    }

    // If online, upload immediately
    uploadAudioMutation.mutate(audioUri);
  };

  const handleSubmitText = () => {
    const elapsedSeconds = Math.round(
      (Date.now() - startTimeRef.current) / 1000
    );
    completeSessionMutation.mutate({
      userResponse: response,
      timeSpent: elapsedSeconds,
    });
  };

  const toggleInputMode = () => {
    setUseAudio(!useAudio);
    setAudioUri(null);
    setResponse("");
    setTranscriptionText("");
  };

  return (
    <ScreenContainer scrollable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
        style={{ flex: 1 }}
      >
        <Card>
          <Text style={styles.title}>{buildSessionTitle(session)}</Text>
          <Tag
            label={`Time limit: ${
              session.timeLimit ? `${session.timeLimit}s` : "Flexible"
            }`}
            tone="info"
          />
          <Text style={styles.question}>{session.question}</Text>
          {session.tips && session.tips.length ? (
            <View style={styles.tipList}>
              {session.tips.map((tip) => (
                <Text key={tip} style={styles.tip}>
                  • {tip}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Mode Toggle */}
          <View style={styles.modeToggleContainer}>
            <TouchableOpacity
              style={[styles.modeButton, useAudio && styles.modeButtonActive]}
              onPress={() => !useAudio && toggleInputMode()}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  useAudio && styles.modeButtonTextActive,
                ]}
              >
                🎤 Audio
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, !useAudio && styles.modeButtonActive]}
              onPress={() => useAudio && toggleInputMode()}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  !useAudio && styles.modeButtonTextActive,
                ]}
              >
                ✍️ Text
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {useAudio ? (
          <Card>
            <Text style={styles.label}>Record your answer</Text>
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              onUploadProgress={setUploadProgress}
              maxDuration={session.timeLimit || 120}
              testMode="practice"
            />

            {audioUri && (
              <View style={styles.recordingInfo}>
                <Text style={styles.recordingInfoText}>
                  ✓ Recording saved ({Math.floor(audioDuration)}s)
                </Text>
              </View>
            )}

            {uploadAudioMutation.isPending && (
              <View style={styles.uploadProgress}>
                <Text style={styles.uploadProgressText}>
                  Uploading... {Math.round(uploadProgress)}%
                </Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${uploadProgress}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            {transcriptionText && (
              <View style={styles.transcriptionContainer}>
                <Text style={styles.transcriptionLabel}>Transcription:</Text>
                <Text style={styles.transcriptionText}>
                  {transcriptionText}
                </Text>
              </View>
            )}

            <Button
              title="Submit Recording"
              onPress={handleSubmitAudio}
              loading={uploadAudioMutation.isPending}
              disabled={!audioUri || uploadAudioMutation.isPending}
            />
          </Card>
        ) : (
          <Card>
            <Text style={styles.label}>Your response</Text>
            <TextInput
              style={styles.input}
              multiline
              value={response}
              onChangeText={setResponse}
              placeholder="Type your answer here..."
              placeholderTextColor={colors.textMuted}
            />
            <Button
              title="Submit Response"
              onPress={handleSubmitText}
              loading={completeSessionMutation.isPending}
              disabled={!response.trim()}
            />
          </Card>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  question: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  tipList: {
    marginTop: spacing.md,
  },
  tip: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.sm,
    minHeight: 160,
    textAlignVertical: "top",
    fontSize: 16,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  modeToggleContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSubtle,
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.primary,
  },
  recordingInfo: {
    backgroundColor: colors.successSoft,
    padding: spacing.sm,
    borderRadius: radii.md,
    marginVertical: spacing.md,
  },
  recordingInfoText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  uploadProgress: {
    marginVertical: spacing.md,
  },
  uploadProgressText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  transcriptionContainer: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transcriptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  transcriptionText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  });
