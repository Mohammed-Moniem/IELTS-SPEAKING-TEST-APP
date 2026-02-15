import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { simulationApi } from "../../api/services";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { Tag } from "../../components/Tag";
import { UsageLimitModal } from "../../components/UsageLimitModal";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import { useUsageGuard } from "../../hooks";
import { SimulationStackParamList } from "../../navigation/SimulationNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { TestSimulation } from "../../types/api";
import { formatDateTime } from "../../utils/date";
import { extractErrorMessage } from "../../utils/errors";

export const SimulationListScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SimulationStackParamList>>();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { ensureCanStart, limitState, dismissLimit, refreshUsage, subscriptionInfo } =
    useUsageGuard();

  const simulationsQuery = useQuery({
    queryKey: ["test-simulations"],
    queryFn: () => simulationApi.list({ limit: 10 }),
  });

  const startSimulationMutation = useMutation({
    mutationFn: async (mode: "voice" | "text") => {
      const simulation = await simulationApi.start();
      return { simulation, mode };
    },
    onSuccess: ({ simulation, mode }) => {
      queryClient
        .invalidateQueries({ queryKey: ["test-simulations"] })
        .catch(() => undefined);
      void refreshUsage();
      navigation.navigate(mode === "voice" ? "SimulationVoiceSession" : "SimulationSession", {
        simulationId: simulation.simulationId,
        parts: simulation.parts.map((part) => ({
          part: part.part,
          question: part.question,
          topicTitle: part.topicTitle,
          timeLimit: part.timeLimit,
          tips: part.tips,
        })),
      });
    },
    onError: (error) => {
      Alert.alert("Cannot start simulation", extractErrorMessage(error));
    },
  });

  const navigateToSimulation = (
    simulation: TestSimulation,
    mode: "voice" | "text"
  ) => {
    navigation.navigate(mode === "voice" ? "SimulationVoiceSession" : "SimulationSession", {
      simulationId: simulation._id,
      parts: simulation.parts.map((part) => ({
        part: part.part,
        question: part.question,
        topicTitle: part.topicTitle,
        timeLimit: part.timeLimit,
        tips: part.tips,
      })),
    });
  };

  const renderItem = ({ item }: { item: TestSimulation }) => (
    <Card>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Simulation • {formatDateTime(item.startedAt)}
          </Text>
          <Text style={styles.meta}>
            {item.parts.length} parts • Overall band {item.overallBand ?? "N/A"}
          </Text>
        </View>
        <Tag
          label={item.status === "completed" ? "Completed" : "In progress"}
          tone={item.status === "completed" ? "success" : "info"}
        />
      </View>
      {item.overallFeedback?.summary ? (
        <Text style={styles.summary}>{item.overallFeedback.summary}</Text>
      ) : null}
      <Button
        title={
          item.status === "completed" ? "View feedback" : "Continue simulation"
        }
        variant="ghost"
        onPress={() => {
          if (item.status === "completed") {
            navigation.navigate("SimulationDetail", { simulation: item });
            return;
          }
          Alert.alert(
            "Continue simulation",
            "Choose how you want to continue.",
            [
              { text: "Voice mode", onPress: () => navigateToSimulation(item, "voice") },
              { text: "Text mode", onPress: () => navigateToSimulation(item, "text") },
              { text: "Cancel", style: "cancel" },
            ]
          );
        }}
      />
    </Card>
  );

  return (
    <ScreenContainer scrollable>
      <SectionHeading title="Practice full simulations">
        Build exam stamina across all three IELTS speaking parts.
      </SectionHeading>

      <Button
        title="Start voice simulation"
        onPress={() => {
          if (!ensureCanStart("simulation")) {
            return;
          }
          startSimulationMutation.mutate("voice");
        }}
        loading={startSimulationMutation.isPending}
      />
      <Button
        title="Start text simulation"
        variant="secondary"
        onPress={() => {
          if (!ensureCanStart("simulation")) {
            return;
          }
          startSimulationMutation.mutate("text");
        }}
        disabled={startSimulationMutation.isPending}
      />

      {simulationsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : simulationsQuery.data && simulationsQuery.data.length ? (
        <FlatList
          data={simulationsQuery.data}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
        />
      ) : (
        <EmptyState
          title="No simulations yet"
          description="Run your first full test to unlock detailed feedback."
        />
      )}

      {limitState && (
        <UsageLimitModal
          visible
          sessionType={limitState.sessionType}
          currentTier={limitState.currentTier}
          used={limitState.used}
          limit={limitState.limit}
          resetDate={limitState.resetDate}
          onClose={dismissLimit}
          upgradeEnabled={!!subscriptionInfo?.stripe?.enabled}
          onUpgrade={() => {
            dismissLimit();
            navigation.getParent()?.navigate("Profile" as never);
          }}
        />
      )}
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  meta: {
    color: colors.textMuted,
  },
  summary: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  });
