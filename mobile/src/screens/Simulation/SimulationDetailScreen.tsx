import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { simulationApi } from "../../api/services";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DetailedFeedbackView } from "../../components/DetailedFeedbackView";
import { EmptyState } from "../../components/EmptyState";
import { NextBestActionsCard } from "../../components/NextBestActionsCard";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { Tag } from "../../components/Tag";
import { useThemedStyles } from "../../hooks";
import { SimulationStackParamList } from "../../navigation/SimulationNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { formatDateTime } from "../../utils/date";

export type SimulationDetailScreenProps = NativeStackScreenProps<
  SimulationStackParamList,
  "SimulationDetail"
>;

export const SimulationDetailScreen: React.FC<SimulationDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { simulation } = route.params;
  const styles = useThemedStyles(createStyles);

  const weakestPart =
    [...(simulation.parts || [])]
      .filter((p) => typeof p?.feedback?.overallBand === "number")
      .sort(
        (a, b) =>
          Number(a.feedback?.overallBand || 0) - Number(b.feedback?.overallBand || 0)
      )[0] || simulation.parts?.[0];

  // Retry simulation mutation
  const retryMutation = useMutation({
    mutationFn: () => simulationApi.start(),
    onSuccess: (data) => {
      navigation.navigate("SimulationSession", {
        simulationId: data.simulationId,
        parts: data.parts.map((p) => ({
          part: p.part,
          question: p.question,
          topicTitle: p.topicTitle,
          timeLimit: p.timeLimit,
          tips: p.tips,
        })),
      });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to start new simulation. Please try again.");
      console.error("Retry simulation error:", error);
    },
  });

  const handleRetry = () => {
    Alert.alert(
      "Start New Simulation",
      "Would you like to start a new full test simulation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: () => retryMutation.mutate(),
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable>
      <SectionHeading title="Simulation summary">
        Completed{" "}
        {formatDateTime(simulation.completedAt || simulation.startedAt)}
      </SectionHeading>

      {/* Overall Summary Card */}
      <Card>
        <View style={styles.summaryRow}>
          <Tag
            label={`Status: ${simulation.status}`}
            tone={simulation.status === "completed" ? "success" : "info"}
          />
          <Text style={styles.bandLabel}>
            Overall band {simulation.overallBand?.toFixed(1) ?? "N/A"}
          </Text>
        </View>
      </Card>

      {/* Overall Detailed Feedback */}
      {simulation.overallFeedback ? (
        <>
          <SectionHeading title="Overall feedback" />
          <DetailedFeedbackView feedback={simulation.overallFeedback} />
        </>
      ) : (
        <Card>
          <EmptyState
            title="Feedback pending"
            description="Complete all parts to receive overall AI feedback."
          />
        </Card>
      )}

      <NextBestActionsCard
        actions={[
          {
            id: "practice-weakest",
            title: weakestPart ? `Speak Part ${weakestPart.part} again` : "Speak practice",
            subtitle: weakestPart
              ? "Retry the weakest part from this simulation in voice mode."
              : "Practice with voice feedback.",
            icon: "mic",
            onPress: () => {
              if (!weakestPart) return;
              const rootNav = navigation.getParent?.() as any;
              rootNav?.navigate?.("Tabs", {
                screen: "VoiceTest",
                params: {
                  retryData: {
                    part: weakestPart.part as 1 | 2 | 3,
                    topic: weakestPart.topicTitle || "Simulation",
                    question: weakestPart.question,
                  },
                },
              });
            },
            disabled: !weakestPart,
          },
          {
            id: "new-sim",
            title: "Start a new simulation",
            subtitle: "Run a fresh mock test across Parts 1–3.",
            icon: "trophy-outline",
            onPress: handleRetry,
          },
        ]}
      />

      {/* Individual Parts */}
      <SectionHeading title="Parts breakdown" />
      {simulation.parts.map((part) => (
        <Card key={part.part}>
          <View style={styles.partHeader}>
            <Text style={styles.partTitle}>Part {part.part}</Text>
            <Tag label={part.topicTitle || "Topic"} />
          </View>

          <View style={styles.partInfo}>
            <Text style={styles.question}>{part.question}</Text>
            {part.response && (
              <View style={styles.responseBlock}>
                <Text style={styles.responseLabel}>Your response:</Text>
                <Text style={styles.responseText}>{part.response}</Text>
              </View>
            )}
            {part.timeSpent !== undefined && (
              <Text style={styles.timeSpent}>
                Time spent: {Math.floor(part.timeSpent / 60)}:
                {String(part.timeSpent % 60).padStart(2, "0")}
              </Text>
            )}
          </View>

          {part.feedback ? (
            <View style={styles.partFeedback}>
              <DetailedFeedbackView feedback={part.feedback} />
            </View>
          ) : (
            <Text style={styles.noFeedback}>
              Feedback pending for this part
            </Text>
          )}
        </Card>
      ))}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title={
            retryMutation.isPending ? "Starting..." : "Start new simulation"
          }
          onPress={handleRetry}
          disabled={retryMutation.isPending}
        />
        <Button
          title="Back to simulations"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bandLabel: {
    fontWeight: "600",
    color: colors.textPrimary,
    fontSize: 16,
  },
  partHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  partTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  partInfo: {
    marginTop: spacing.md,
  },
  question: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  responseBlock: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
  },
  responseLabel: {
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  responseText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  timeSpent: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
  },
  partFeedback: {
    marginTop: spacing.md,
  },
  noFeedback: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  });
