import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { simulationApi } from "../../api/services";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { Tag } from "../../components/Tag";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { SimulationStackParamList } from "../../navigation/SimulationNavigator";
import offlineStorage from "../../services/offlineStorage";
import type { ColorTokens } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";

export type SimulationSessionScreenProps = NativeStackScreenProps<
  SimulationStackParamList,
  "SimulationSession"
>;

type ResponseRecord = Record<number, string>;
const DRAFT_STORAGE_PREFIX = "@simulation_draft:";

export const SimulationSessionScreen: React.FC<
  SimulationSessionScreenProps
> = ({ route, navigation }) => {
  const { simulationId, parts } = route.params;
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [responses, setResponses] = useState<ResponseRecord>({});
  const [draftHydrated, setDraftHydrated] = useState(false);
  const startTimes = useRef<Record<number, number>>({});
  const overallStartRef = useRef(Date.now());

  const orderedParts = useMemo(
    () => [...parts].sort((a, b) => a.part - b.part),
    [parts]
  );
  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}${simulationId}`;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(draftStorageKey)
      .then((rawDraft) => {
        if (!mounted) {
          return;
        }

        if (!rawDraft) {
          setDraftHydrated(true);
          return;
        }

        try {
          const parsed = JSON.parse(rawDraft) as ResponseRecord;
          if (parsed && typeof parsed === "object") {
            setResponses(parsed);
          }
        } catch (error) {
          console.warn("⚠️ Failed to parse simulation draft:", error);
        } finally {
          setDraftHydrated(true);
        }
      })
      .catch((error) => {
        console.warn("⚠️ Failed to load simulation draft:", error);
        if (mounted) {
          setDraftHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    if (Object.keys(responses).length === 0) {
      AsyncStorage.removeItem(draftStorageKey).catch((error) =>
        console.warn("⚠️ Failed to clear simulation draft:", error)
      );
      return;
    }

    AsyncStorage.setItem(draftStorageKey, JSON.stringify(responses)).catch(
      (error) => console.warn("⚠️ Failed to persist simulation draft:", error)
    );
  }, [responses, draftHydrated, draftStorageKey]);

  // Process queue when back online
  useEffect(() => {
    if (isOnline) {
      offlineStorage
        .processQueue(async (item) => {
          // For now, we don't have a direct simulation audio upload endpoint
          // This would need backend support similar to practice sessions
          console.log("Queued simulation recording:", item.id);
        })
        .catch((error) =>
          console.warn("⚠️ Simulation queue processing warning:", error)
        );
    }
  }, [isOnline]);

  const completeSimulationMutation = useMutation({
    mutationFn: (
      payload: {
        part: number;
        question: string;
        response?: string;
        timeSpent?: number;
      }[]
    ) => simulationApi.complete(simulationId, payload),
    onSuccess: (simulation) => {
      AsyncStorage.removeItem(draftStorageKey).catch((error) =>
        console.warn("⚠️ Failed to clear simulation draft after submit:", error)
      );
      queryClient
        .invalidateQueries({ queryKey: ["test-simulations"] })
        .catch(() => undefined);
      navigation.replace("SimulationDetail", { simulation });
    },
    onError: (error) => {
      Alert.alert("Unable to complete simulation", extractErrorMessage(error));
    },
  });

  const updateResponse = (part: number, text: string) => {
    if (!startTimes.current[part]) {
      startTimes.current[part] = Date.now();
    }
    setResponses((prev) => ({
      ...prev,
      [part]: text,
    }));
  };

  const handleComplete = () => {
    const elapsed = Math.round((Date.now() - overallStartRef.current) / 1000);
    if (elapsed < 60) {
      Alert.alert(
        "Heads up",
        "Consider spending more time to simulate the real exam experience."
      );
    }

    const payload = orderedParts.map((part) => {
      const startedAt =
        startTimes.current[part.part] ?? overallStartRef.current;
      const timeSpent = Math.round((Date.now() - startedAt) / 1000);
      return {
        part: part.part,
        question: part.question,
        response: responses[part.part] ?? "",
        timeSpent,
      };
    });

    completeSimulationMutation.mutate(payload);
  };

  const answeredCount = orderedParts.filter(
    (part) => (responses[part.part] ?? "").trim().length > 0
  ).length;
  const progressRatio =
    orderedParts.length > 0 ? answeredCount / orderedParts.length : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const getPartGuidance = (partNumber: number): string => {
    if (partNumber === 1) {
      return "Aim for concise 20-40 second answers with direct examples.";
    }
    if (partNumber === 2) {
      return "Structure your response: context, details, and reflection.";
    }
    return "Develop your opinion with reasons and one concrete example.";
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.progressCard}>
            <Text style={styles.progressTitle}>Exam mode</Text>
            <Text style={styles.progressSubtitle}>
              Complete all {orderedParts.length} parts for a realistic IELTS flow.
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>
            <Text style={styles.progressMeta}>
              {answeredCount} of {orderedParts.length} parts drafted
            </Text>
            {draftHydrated && answeredCount > 0 ? (
              <Text style={styles.draftRestored}>Saved draft restored.</Text>
            ) : null}
          </Card>
          {orderedParts.map((part) => (
            <Card key={part.part}>
              <View style={styles.partHeader}>
                <View>
                  <Text style={styles.partTitle}>Part {part.part}</Text>
                  <Text style={styles.milestone}>
                    Milestone {part.part} of {orderedParts.length}
                  </Text>
                </View>
                <Tag
                  label={part.timeLimit ? `${part.timeLimit}s` : "Flexible"}
                  tone="info"
                />
              </View>
              <Text style={styles.topicTitle}>{part.topicTitle}</Text>
              <Text style={styles.question}>{part.question}</Text>
              <View style={styles.guidanceNotice}>
                <Text style={styles.guidanceNoticeText}>
                  {getPartGuidance(part.part)}
                </Text>
              </View>
              {part.tips && part.tips.length ? (
                <View style={styles.tipList}>
                  {part.tips.map((tip) => (
                    <Text key={tip} style={styles.tip}>
                      • {tip}
                    </Text>
                  ))}
                </View>
              ) : null}
              <TextInput
                multiline
                placeholder="Capture your speaking response here..."
                value={responses[part.part] ?? ""}
                onChangeText={(text) => updateResponse(part.part, text)}
                style={styles.input}
                textAlignVertical="top"
                placeholderTextColor={colors.textMuted}
              />
            </Card>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title="Complete simulation"
            onPress={handleComplete}
            loading={completeSimulationMutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      paddingBottom: spacing.xxl + spacing.lg,
    },
    progressCard: {
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    progressTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },
    progressSubtitle: {
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    progressTrack: {
      height: 8,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceSubtle,
      overflow: "hidden",
      marginBottom: spacing.xs,
    },
    progressFill: {
      height: "100%",
      borderRadius: radii.full,
      backgroundColor: colors.primary,
    },
    progressMeta: {
      color: colors.textMutedStrong,
      fontSize: 13,
      fontWeight: "600",
    },
    draftRestored: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    partHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    partTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    milestone: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xxs,
      fontWeight: "600",
    },
    topicTitle: {
      color: colors.textSecondary,
      marginBottom: spacing.xs + 2,
    },
    question: {
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    guidanceNotice: {
      backgroundColor: colors.statusInfoBackground,
      borderColor: colors.statusInfoBorder,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    guidanceNoticeText: {
      color: colors.statusInfoText,
      fontSize: 13,
      fontWeight: "600",
    },
    tipList: {
      marginBottom: spacing.md,
    },
    tip: {
      color: colors.textMuted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.xl,
      padding: spacing.sm,
      minHeight: 140,
      backgroundColor: colors.surface,
      fontSize: 16,
      marginTop: spacing.md,
      color: colors.textPrimary,
    },
    footer: {
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderMuted,
      backgroundColor: colors.surfaceSubtle,
    },
  });
