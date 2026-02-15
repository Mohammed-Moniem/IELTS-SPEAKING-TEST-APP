import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useRef, useState } from "react";
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

export const SimulationSessionScreen: React.FC<
  SimulationSessionScreenProps
> = ({ route, navigation }) => {
  const { simulationId, parts } = route.params;
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [responses, setResponses] = useState<ResponseRecord>({});
  const startTimes = useRef<Record<number, number>>({});
  const overallStartRef = useRef(Date.now());

  const orderedParts = useMemo(
    () => [...parts].sort((a, b) => a.part - b.part),
    [parts]
  );

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
      queryClient
        .invalidateQueries({ queryKey: ["test-simulations"] })
        .catch(() => undefined);
      queryClient
        .invalidateQueries({ queryKey: ["simulation-results"] })
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

    if (isOffline) {
      offlineStorage
        .queueSimulationCompletion({
          id: `${simulationId}-${Date.now()}`,
          simulationId,
          parts: payload,
          timestamp: Date.now(),
        })
        .then(() => {
          Alert.alert(
            "Saved offline",
            "Your simulation answers have been saved and will sync when you're back online.",
            [
              {
                text: "OK",
                onPress: () => navigation.goBack(),
              },
            ]
          );
        })
        .catch(() => {
          Alert.alert(
            "Unable to save",
            "Could not save your simulation for offline sync. Please try again."
          );
        });
      return;
    }

    completeSimulationMutation.mutate(payload);
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {orderedParts.map((part) => (
            <Card key={part.part}>
              <View style={styles.partHeader}>
                <Text style={styles.partTitle}>Part {part.part}</Text>
                <Tag
                  label={part.timeLimit ? `${part.timeLimit}s` : "Flexible"}
                  tone="info"
                />
              </View>
              <Text style={styles.topicTitle}>{part.topicTitle}</Text>
              <Text style={styles.question}>{part.question}</Text>
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
  topicTitle: {
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
  },
  question: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    backgroundColor: colors.surfaceSubtle,
  },
  });
