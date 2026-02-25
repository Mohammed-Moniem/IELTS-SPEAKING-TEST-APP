import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { practiceApi, topicApi } from "../../api/services";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ProfileMenu } from "../../components/ProfileMenu";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { TopicListSkeleton } from "../../components/skeletons/PracticeSkeletons";
import { UsageLimitModal } from "../../components/UsageLimitModal";
import { Tag } from "../../components/Tag";
import { useTheme } from "../../context";
import { useThemedStyles, useUsageGuard } from "../../hooks";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { PracticeStackParamList } from "../../navigation/PracticeNavigator";
import offlineStorage from "../../services/offlineStorage";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { PracticeSession, PracticeSessionStart, Topic } from "../../types/api";
import { extractErrorMessage } from "../../utils/errors";

const getExpectedDuration = (part: number): string => {
  if (part === 1) {
    return "6-8 min";
  }
  if (part === 2) {
    return "4-6 min";
  }
  return "8-10 min";
};

const getPredictedOutcome = (difficulty: Topic["difficulty"]): string => {
  if (difficulty === "beginner") {
    return "Improves confidence and fluency";
  }
  if (difficulty === "advanced") {
    return "Sharpens coherence and band precision";
  }
  return "Builds fluency and vocabulary range";
};

const toPracticeSessionStart = (
  session: PracticeSession
): PracticeSessionStart => ({
  sessionId: session._id,
  topic: {
    _id: session.topicId,
    slug: session.topicId || session._id,
    title: session.topicTitle,
    description: session.question,
    part: session.part,
    category: session.category || `part${session.part}`,
    difficulty:
      session.difficulty === "beginner" ||
      session.difficulty === "advanced" ||
      session.difficulty === "intermediate"
        ? session.difficulty
        : "intermediate",
    isPremium: false,
  },
  question: session.question,
});

export const PracticeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<PracticeStackParamList>>();
  const queryClient = useQueryClient();
  const { isOnline, isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { ensureCanStart, limitState, dismissLimit, refreshUsage } =
    useUsageGuard();
  const [cachedTopics, setCachedTopics] = useState<Topic[]>([]);

  // Add header with profile icon - ProfileMenu manages its own state
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <ProfileMenu />,
    });
  }, [navigation]);

  // Replace useQuery with useInfiniteQuery for topics
  const topicsQuery = useInfiniteQuery({
    queryKey: ["topics-infinite"],
    queryFn: ({ pageParam = 0 }) =>
      topicApi.getPractice({
        limit: 10,
        offset: pageParam,
        excludeCompleted: true,
      }),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined;
    },
    initialPageParam: 0,
    enabled: isOnline !== false, // Only fetch when online
  });

  const sessionsQuery = useQuery({
    queryKey: ["practice-sessions", "in-progress"],
    queryFn: () =>
      practiceApi.listSessions({
        limit: 20,
        offset: 0,
      }),
    enabled: isOnline !== false,
  });

  // Flatten paginated topics data
  const topics = topicsQuery.data?.pages.flatMap((page) => page.topics) ?? [];

  // Cache topics when online and data loads
  useEffect(() => {
    if (isOnline && topics.length > 0) {
      offlineStorage
        .cacheTopics(topics)
        .catch((error) => console.warn("⚠️ Topic cache warning:", error));
    }
  }, [isOnline, topics]);

  // Load cached topics when offline
  useEffect(() => {
    if (isOffline) {
      offlineStorage
        .getCachedTopics()
        .then((cached) => {
          // Convert CachedTopic to Topic format
          const converted: Topic[] = cached.map((t) => ({
            _id: t._id,
            title: t.title,
            slug: t.slug,
            part: t.part,
            category: t.category,
            difficulty: t.difficulty as
              | "beginner"
              | "intermediate"
              | "advanced",
            description: t.questions[0] || "",
            isPremium: false,
          }));
          setCachedTopics(converted);
        })
        .catch((error) => console.warn("⚠️ Cached topics read warning:", error));
    }
  }, [isOffline]);

  // Use cached topics if offline, otherwise use fetched topics
  const displayTopics =
    isOffline && cachedTopics.length > 0 ? cachedTopics : topics;

  const resumeSession = (sessionsQuery.data ?? [])
    .filter((session) => session.status === "in_progress")
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

  const startSessionMutation = useMutation({
    mutationFn: (topicId: string) => practiceApi.startSession(topicId),
    onSuccess: (session) => {
      queryClient
        .invalidateQueries({ queryKey: ["practice-sessions"] })
        .catch(() => undefined);
      navigation.navigate("PracticeSession", { session });
      void refreshUsage();
    },
    onError: (error) => {
      Alert.alert("Cannot start session", extractErrorMessage(error));
    },
  });

  const renderTopicItem = ({ item: topic }: { item: Topic }) => {
    const expectedDuration = getExpectedDuration(topic.part);
    const predictedOutcome = getPredictedOutcome(topic.difficulty);

    return (
      <Card key={topic.slug}>
        <View>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          <View style={styles.topicMetaRow}>
            <Text style={styles.topicMeta}>
              Part {topic.part} • {topic.difficulty}
            </Text>
            {topic.isPremium ? <Tag label="Premium" tone="premium" /> : null}
          </View>
          {topic.isPremium ? (
            <Text style={styles.premiumReason}>
              Premium unlocks deeper band-focused feedback for this prompt.
            </Text>
          ) : null}
        </View>
        <Text style={styles.topicDescription}>{topic.description}</Text>
        <View style={styles.expectationsRow}>
          <Text style={styles.expectationText}>Duration: {expectedDuration}</Text>
          <Text style={styles.expectationText}>
            Outcome: {predictedOutcome}
          </Text>
        </View>
        <Button
          title="Start practice"
          onPress={() => {
            if (!ensureCanStart("practice")) {
              return;
            }
            startSessionMutation.mutate(topic.slug);
          }}
          loading={startSessionMutation.isPending}
          accessibilityLabel={`Start practice for ${topic.title}`}
          accessibilityHint="Begin this IELTS speaking topic session"
        />
      </Card>
    );
  };

  const renderTopicsFooter = () => {
    if (topicsQuery.isFetchingNextPage) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.footerText}>Loading more topics...</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <ScreenContainer scrollable>
      {resumeSession ? (
        <Card style={styles.resumeCard}>
          <Text style={styles.resumeLabel}>Resume session</Text>
          <Text style={styles.resumeTitle}>{resumeSession.topicTitle}</Text>
          <Text style={styles.resumeMeta}>
            Part {resumeSession.part} • In progress
          </Text>
          <Button
            title="Resume now"
            variant="secondary"
            onPress={() =>
              navigation.navigate("PracticeSession", {
                session: toPracticeSessionStart(resumeSession),
              })
            }
            style={styles.resumeButton}
            accessibilityLabel={`Resume session for ${resumeSession.topicTitle}`}
            accessibilityHint="Continue your in-progress speaking session"
          />
        </Card>
      ) : null}
      <SectionHeading title="Choose a topic">
        Pick an area to practice and receive AI-powered feedback.
      </SectionHeading>

      {topicsQuery.isLoading ? (
        <TopicListSkeleton count={3} />
      ) : displayTopics.length > 0 ? (
        <>
          {isOffline && cachedTopics.length > 0 && (
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineNoticeText}>
                Showing {cachedTopics.length} cached topics while offline.
              </Text>
            </View>
          )}
          <FlatList
            data={displayTopics}
            renderItem={renderTopicItem}
            keyExtractor={(item) =>
              item._id ? `${item._id}` : `${item.slug}-${item.part}`
            }
            scrollEnabled={false}
            onEndReached={() => {
              if (topicsQuery.hasNextPage && !topicsQuery.isFetchingNextPage) {
                topicsQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderTopicsFooter}
          />
        </>
      ) : (
        <EmptyState
          title="No topics available"
          description="Check back later for new speaking prompts."
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
    resumeCard: {
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    resumeLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    resumeTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    resumeMeta: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: spacing.sm,
    },
    resumeButton: {
      marginTop: spacing.xs,
    },
    topicTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    topicMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    topicMeta: {
      color: colors.textMuted,
      fontSize: 14,
    },
    premiumReason: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: spacing.xs,
    },
    topicDescription: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      color: colors.textSecondary,
    },
    expectationsRow: {
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    expectationText: {
      color: colors.textMutedStrong,
      fontSize: 13,
      fontWeight: "600",
    },
    footerLoader: {
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    footerText: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontSize: 14,
    },
    offlineNotice: {
      backgroundColor: colors.statusInfoBackground,
      padding: spacing.sm,
      borderRadius: 10,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.statusInfoBorder,
    },
    offlineNoticeText: {
      color: colors.statusInfoText,
      fontSize: 14,
      fontWeight: "600",
    },
  });
