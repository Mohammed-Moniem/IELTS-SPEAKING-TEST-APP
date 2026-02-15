import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { transcribeAudio } from "../../api/speechApi";
import { simulationApi } from "../../api/services";
import { AudioRecorder } from "../../components/AudioRecorder";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { Tag } from "../../components/Tag";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { SimulationStackParamList } from "../../navigation/SimulationNavigator";
import { ttsService } from "../../services/textToSpeechService";
import type { ColorTokens } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";

export type SimulationVoiceSessionScreenProps = NativeStackScreenProps<
  SimulationStackParamList,
  "SimulationVoiceSession"
>;

type AudioState = {
  uri: string;
  durationSeconds: number;
  audioRecordingId?: string;
};

export const SimulationVoiceSessionScreen: React.FC<
  SimulationVoiceSessionScreenProps
> = ({ route, navigation }) => {
  const { simulationId, parts } = route.params;
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const orderedParts = useMemo(
    () => [...parts].sort((a, b) => a.part - b.part),
    [parts]
  );

  const [partIndex, setPartIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [audioByPart, setAudioByPart] = useState<Record<number, AudioState>>(
    {}
  );
  const [transcribingPart, setTranscribingPart] = useState<number | null>(null);
  const [examinerSpeaking, setExaminerSpeaking] = useState(false);
  const [prepSecondsLeft, setPrepSecondsLeft] = useState<number | null>(null);

  const currentPart = orderedParts[partIndex];
  const currentPartNumber = currentPart?.part as 1 | 2 | 3;
  const currentTimeLimit = currentPart?.timeLimit;

  useEffect(() => {
    let cancelled = false;

    if (!currentPart) {
      return;
    }

    if (isOffline) {
      // Voice simulation depends on live transcription.
      return;
    }

    // Part 2: enforce a 60-second prep countdown (skippable).
    setPrepSecondsLeft(currentPartNumber === 2 ? 60 : null);

    const speakPrompt = async () => {
      try {
        setExaminerSpeaking(true);
        await ttsService.speakIntroductionAndQuestion(
          currentPartNumber,
          currentPart.question
        );
      } catch {
        // Ignore TTS failures; user can still proceed.
      } finally {
        if (!cancelled) {
          setExaminerSpeaking(false);
        }
      }
    };

    void speakPrompt();

    return () => {
      cancelled = true;
      ttsService.stop().catch(() => undefined);
    };
  }, [currentPart?.question, currentPartNumber, isOffline, partIndex]);

  useEffect(() => {
    if (prepSecondsLeft === null) return;
    if (prepSecondsLeft <= 0) return;

    const interval = setInterval(() => {
      setPrepSecondsLeft((prev) => {
        if (prev === null) return prev;
        return Math.max(0, prev - 1);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [prepSecondsLeft]);

  const handleReplayPrompt = async () => {
    if (!currentPart) return;
    if (isOffline) {
      Alert.alert("Offline", "Voice simulation requires an internet connection.");
      return;
    }

    try {
      setExaminerSpeaking(true);
      await ttsService.stop();
      await ttsService.speakIntroductionAndQuestion(
        currentPartNumber,
        currentPart.question
      );
    } catch {
      // ignore
    } finally {
      setExaminerSpeaking(false);
    }
  };

  const handleRecordingComplete = async (uri: string, duration: number) => {
    if (!currentPart) return;

    const part = currentPart.part;
    setAudioByPart((prev) => ({
      ...prev,
      [part]: {
        uri,
        durationSeconds: Math.max(0, Math.round(duration || 0)),
      },
    }));

    if (isOffline) {
      Alert.alert(
        "Offline",
        "Transcription requires an internet connection. Switch to text simulation if you need offline mode."
      );
      return;
    }

    setTranscribingPart(part);
    try {
      const result = await transcribeAudio(uri, {
        sessionId: simulationId,
        topic: currentPart.topicTitle,
        testPart: `part${part}`,
        recordingType: "simulation",
      });

      setResponses((prev) => ({
        ...prev,
        [part]: result.text || "",
      }));

      if (result.audioRecordingId) {
        setAudioByPart((prev) => ({
          ...prev,
          [part]: {
            ...prev[part],
            audioRecordingId: result.audioRecordingId,
          },
        }));
      }
    } catch (error) {
      Alert.alert("Transcription failed", extractErrorMessage(error));
    } finally {
      setTranscribingPart(null);
    }
  };

  const canRecord =
    !isOffline &&
    !examinerSpeaking &&
    transcribingPart === null &&
    (currentPartNumber !== 2 || (prepSecondsLeft ?? 0) <= 0);

  const completeSimulationMutation = useMutation({
    mutationFn: (payload: {
      part: number;
      question: string;
      response?: string;
      timeSpent?: number;
    }[]) => simulationApi.complete(simulationId, payload),
    onSuccess: (simulation) => {
      queryClient
        .invalidateQueries({ queryKey: ["test-simulations"] })
        .catch(() => undefined);
      queryClient
        .invalidateQueries({ queryKey: ["usage-summary"] })
        .catch(() => undefined);
      navigation.replace("SimulationDetail", { simulation });
    },
    onError: (error) => {
      Alert.alert("Unable to complete simulation", extractErrorMessage(error));
    },
  });

  const handleComplete = () => {
    if (isOffline) {
      Alert.alert(
        "Offline",
        "Voice simulation needs an internet connection to transcribe and evaluate."
      );
      return;
    }

    const missing = orderedParts.find((p) => {
      const text = (responses[p.part] || "").trim();
      return !text.length;
    });

    if (missing) {
      Alert.alert(
        "Missing answer",
        `Please record (and transcribe) an answer for Part ${missing.part} before completing the simulation.`
      );
      return;
    }

    const payload = orderedParts.map((p) => ({
      part: p.part,
      question: p.question,
      response: responses[p.part] || "",
      timeSpent: audioByPart[p.part]?.durationSeconds,
    }));

    completeSimulationMutation.mutate(payload);
  };

  if (!currentPart) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Simulation not found</Text>
          <Button title="Go back" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </ScreenContainer>
    );
  }

  const transcript = responses[currentPart.part] || "";
  const recordingMeta = audioByPart[currentPart.part];

  return (
    <ScreenContainer scrollable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeading title="Voice simulation">
            Full IELTS mock test with examiner prompts. Speak your answers and get feedback.
          </SectionHeading>

          {isOffline ? (
            <Card>
              <Text style={styles.offlineTitle}>Offline</Text>
              <Text style={styles.offlineText}>
                Voice simulation requires an internet connection (transcription + evaluation).
              </Text>
              <Button
                title="Back to simulations"
                variant="ghost"
                onPress={() => navigation.goBack()}
              />
            </Card>
          ) : null}

          <Card>
            <View style={styles.partHeaderRow}>
              <View>
                <Text style={styles.partTitle}>Part {currentPart.part}</Text>
                <Text style={styles.partMeta}>
                  {currentPart.topicTitle ? currentPart.topicTitle : ""}
                </Text>
              </View>
              <View style={styles.partHeaderRight}>
                {currentTimeLimit ? (
                  <Tag label={`${currentTimeLimit}s`} tone="info" />
                ) : (
                  <Tag label="Flexible" tone="info" />
                )}
                {currentPartNumber === 2 && prepSecondsLeft !== null && prepSecondsLeft > 0 ? (
                  <Tag label={`Prep ${prepSecondsLeft}s`} tone="warning" />
                ) : null}
              </View>
            </View>

            <Text style={styles.question}>{currentPart.question}</Text>

            {Array.isArray(currentPart.tips) && currentPart.tips.length ? (
              <View style={styles.tipList}>
                {currentPart.tips.map((tip) => (
                  <Text key={tip} style={styles.tip}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <Button
                title={examinerSpeaking ? "Examiner speaking…" : "Replay prompt"}
                variant="secondary"
                onPress={handleReplayPrompt}
                disabled={examinerSpeaking || completeSimulationMutation.isPending}
              />
              {currentPartNumber === 2 && prepSecondsLeft !== null && prepSecondsLeft > 0 ? (
                <Button
                  title="Skip prep"
                  variant="ghost"
                  onPress={() => setPrepSecondsLeft(0)}
                />
              ) : null}
            </View>
          </Card>

          <Card>
            <Text style={styles.label}>Record your answer</Text>
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              maxDuration={
                currentPartNumber === 2
                  ? 120
                  : Math.max(120, Math.min(5 * 60, currentTimeLimit || 240))
              }
              disabled={!canRecord}
              testMode="simulation"
            />

            {recordingMeta?.uri ? (
              <View style={styles.recordingInfo}>
                <Text style={styles.recordingInfoText}>
                  ✓ Recording saved ({recordingMeta.durationSeconds}s)
                </Text>
              </View>
            ) : null}

            {transcribingPart === currentPart.part ? (
              <View style={styles.transcribingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.transcribingText}>Transcribing…</Text>
              </View>
            ) : null}

            <View style={styles.transcriptionContainer}>
              <Text style={styles.transcriptionLabel}>Transcript</Text>
              <TextInput
                style={styles.transcriptionInput}
                multiline
                placeholder="Your transcript will appear here (you can edit it)."
                placeholderTextColor={colors.textMuted}
                value={transcript}
                onChangeText={(text) =>
                  setResponses((prev) => ({
                    ...prev,
                    [currentPart.part]: text,
                  }))
                }
              />
            </View>
          </Card>

          <View style={styles.navRow}>
            <Button
              title="Back"
              variant="ghost"
              onPress={() => setPartIndex((v) => Math.max(0, v - 1))}
              disabled={partIndex === 0 || completeSimulationMutation.isPending}
            />

            {partIndex < orderedParts.length - 1 ? (
              <Button
                title="Next part"
                onPress={() => setPartIndex((v) => Math.min(orderedParts.length - 1, v + 1))}
                disabled={
                  completeSimulationMutation.isPending ||
                  examinerSpeaking ||
                  transcribingPart !== null
                }
              />
            ) : (
              <Button
                title="Complete simulation"
                onPress={handleComplete}
                loading={completeSimulationMutation.isPending}
                disabled={examinerSpeaking || transcribingPart !== null}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      paddingBottom: spacing.xxl,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    partHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    partHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    partTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    partMeta: {
      marginTop: 2,
      color: colors.textMuted,
    },
    question: {
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 22,
    },
    tipList: {
      marginTop: spacing.md,
    },
    tip: {
      color: colors.textMuted,
      marginBottom: 4,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    label: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    recordingInfo: {
      backgroundColor: colors.surfaceSubtle,
      padding: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.md,
    },
    recordingInfoText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    transcribingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    transcribingText: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
    transcriptionContainer: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    transcriptionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    transcriptionInput: {
      minHeight: 130,
      color: colors.textPrimary,
      textAlignVertical: "top",
      lineHeight: 22,
    },
    navRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    offlineTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    offlineText: {
      color: colors.textSecondary,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
  });
