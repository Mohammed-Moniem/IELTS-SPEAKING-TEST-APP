import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { practiceApi } from "../../api/services";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DetailedFeedbackView } from "../../components/DetailedFeedbackView";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { Tag } from "../../components/Tag";
import { PracticeStackParamList } from "../../navigation/PracticeNavigator";
import { colors, spacing } from "../../theme/tokens";
import { formatDateTime } from "../../utils/date";
import { extractErrorMessage } from "../../utils/errors";

type PracticeResultDetailScreenRouteProp = RouteProp<
  PracticeStackParamList,
  "PracticeResultDetail"
>;

export const PracticeResultDetailScreen: React.FC = () => {
  const route = useRoute<PracticeResultDetailScreenRouteProp>();
  const navigation =
    useNavigation<NativeStackNavigationProp<PracticeStackParamList>>();
  const queryClient = useQueryClient();

  const { sessionId } = route.params;

  // Fetch session details
  const sessionQuery = useQuery({
    queryKey: ["practice-session", sessionId],
    queryFn: async () => {
      const sessions = await practiceApi.listSessions({ limit: 100 });
      const session = sessions.find((s) => s._id === sessionId);
      if (!session) {
        throw new Error("Session not found");
      }
      return session;
    },
  });

  // Retry topic mutation
  const retryMutation = useMutation({
    mutationFn: (topicId: string) => practiceApi.startSession(topicId),
    onSuccess: (session) => {
      queryClient
        .invalidateQueries({ queryKey: ["practice-sessions"] })
        .catch(() => undefined);
      navigation.navigate("PracticeSession", { session });
    },
    onError: (error) => {
      Alert.alert("Cannot start session", extractErrorMessage(error));
    },
  });

  if (sessionQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading session details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Session not found"
          description="This practice session could not be loaded."
        />
        <Button
          title="Go back"
          onPress={() => navigation.goBack()}
          variant="ghost"
        />
      </ScreenContainer>
    );
  }

  const session = sessionQuery.data;
  const isCompleted = session.status === "completed";

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Session Info Card */}
        <Card>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.topicTitle}>{session.topicTitle}</Text>
              <Text style={styles.metaText}>
                Part {session.part} • {formatDateTime(session.startedAt)}
              </Text>
            </View>
            <Tag
              label={isCompleted ? "Completed" : "In progress"}
              tone={isCompleted ? "success" : "info"}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.questionContainer}>
            <Text style={styles.questionLabel}>Question:</Text>
            <Text style={styles.questionText}>{session.question}</Text>
          </View>

          {session.userResponse && (
            <View style={styles.responseContainer}>
              <Text style={styles.responseLabel}>Your Response:</Text>
              <Text style={styles.responseText}>{session.userResponse}</Text>
            </View>
          )}

          {session.timeSpent && (
            <Text style={styles.timeSpentText}>
              Time spent: {Math.round(session.timeSpent / 60)} minutes
            </Text>
          )}
        </Card>

        {/* Feedback Section */}
        {isCompleted && session.feedback ? (
          <DetailedFeedbackView feedback={session.feedback} />
        ) : (
          <Card>
            <EmptyState
              title="No feedback available yet"
              description="Complete the session to receive AI-powered feedback on your performance."
            />
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Retry this topic"
            onPress={() => retryMutation.mutate(session.topicId)}
            loading={retryMutation.isPending}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="Back to practice"
            onPress={() => navigation.navigate("PracticeHome")}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  topicTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  questionContainer: {
    marginBottom: spacing.md,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  responseContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  responseText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    fontStyle: "italic",
  },
  timeSpentText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actionButtons: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  actionButton: {
    width: "100%",
  },
});
