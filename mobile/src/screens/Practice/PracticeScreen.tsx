import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  useInfiniteQuery,
  useMutation,
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
import { OfflineBanner } from "../../components/OfflineBanner";
import { ProfileMenu } from "../../components/ProfileMenu";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { Tag } from "../../components/Tag";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { PracticeStackParamList } from "../../navigation/PracticeNavigator";
import offlineStorage from "../../services/offlineStorage";
import { colors, spacing } from "../../theme/tokens";
import { Topic } from "../../types/api";
import { extractErrorMessage } from "../../utils/errors";

export const PracticeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<PracticeStackParamList>>();
  const queryClient = useQueryClient();
  const { isOnline, isOffline } = useNetworkStatus();
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

  // Flatten paginated topics data
  const topics = topicsQuery.data?.pages.flatMap((page) => page.topics) ?? [];

  // Cache topics when online and data loads
  useEffect(() => {
    if (isOnline && topics.length > 0) {
      offlineStorage.cacheTopics(topics).catch(console.error);
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
        .catch(console.error);
    }
  }, [isOffline]);

  // Use cached topics if offline, otherwise use fetched topics
  const displayTopics =
    isOffline && cachedTopics.length > 0 ? cachedTopics : topics;

  const startSessionMutation = useMutation({
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

  const renderTopicItem = ({ item: topic }: { item: Topic }) => {
    return (
      <Card key={topic.slug}>
        <View>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          <View style={styles.topicMetaRow}>
            <Text style={styles.topicMeta}>
              Part {topic.part} • {topic.difficulty}
            </Text>
            {topic.isPremium ? <Tag label="Premium" tone="warning" /> : null}
          </View>
        </View>
        <Text style={styles.topicDescription}>{topic.description}</Text>
        <Button
          title="Start practice"
          onPress={() => startSessionMutation.mutate(topic.slug)}
          loading={startSessionMutation.isPending}
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
      <OfflineBanner showQueueCount />
      <SectionHeading title="Choose a topic">
        Pick an area to practice and receive AI-powered feedback.
      </SectionHeading>

      {topicsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : displayTopics.length > 0 ? (
        <>
          {isOffline && cachedTopics.length > 0 && (
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineNoticeText}>
                📚 Showing {cachedTopics.length} cached topics
              </Text>
            </View>
          )}
          <FlatList
            data={displayTopics}
            renderItem={renderTopicItem}
            keyExtractor={(item) => item.slug}
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
  },
  topicMeta: {
    color: colors.textMuted,
    fontSize: 14,
  },
  topicDescription: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    color: colors.textSecondary,
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
    backgroundColor: "#FEF3C7",
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  offlineNoticeText: {
    color: "#92400E",
    fontSize: 14,
    fontWeight: "600",
  },
});
