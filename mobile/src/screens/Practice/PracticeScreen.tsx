import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { favoritesApi, practiceApi, topicApi } from "../../api/services";
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
import { Topic } from "../../types/api";
import { extractErrorMessage } from "../../utils/errors";

export const PracticeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<PracticeStackParamList>>();
  const queryClient = useQueryClient();
  const { isOnline, isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { ensureCanStart, limitState, dismissLimit, refreshUsage, subscriptionInfo } =
    useUsageGuard();
  const [cachedTopics, setCachedTopics] = useState<Topic[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState<1 | 2 | 3 | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    "beginner" | "intermediate" | "advanced" | null
  >(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Add header with profile icon - ProfileMenu manages its own state
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <ProfileMenu />,
    });
  }, [navigation]);

  // Replace useQuery with useInfiniteQuery for topics
  const topicsQuery = useInfiniteQuery({
    queryKey: [
      "topics-infinite",
      selectedPart ?? "all",
      selectedDifficulty ?? "all",
      debouncedSearch || "",
    ],
    queryFn: ({ pageParam = 0 }) =>
      topicApi.getPractice({
        limit: 10,
        offset: pageParam,
        excludeCompleted: true,
        category: selectedPart ? (`part${selectedPart}` as any) : undefined,
        difficulty: selectedDifficulty ?? undefined,
        q: debouncedSearch || undefined,
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

  const favoriteTopicsQuery = useQuery({
    queryKey: ["favorites", "topic"],
    queryFn: () => favoritesApi.list("topic"),
    enabled: isOnline && !isOffline, // skip when offline
  });

  const favoriteTopicIds = new Set<string>(favoriteTopicsQuery.data ?? []);

  const toggleTopicFavorite = useMutation({
    mutationFn: async (payload: { topicId: string; isFavorite: boolean }) => {
      if (payload.isFavorite) {
        await favoritesApi.remove("topic", payload.topicId);
        return;
      }
      await favoritesApi.add({ entityType: "topic", entityId: payload.topicId });
    },
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: ["favorites", "topic"] })
        .catch(() => undefined);
    },
    onError: (error) => {
      Alert.alert("Unable to update favorite", extractErrorMessage(error));
    },
  });

  const filteredTopics = displayTopics.filter((topic) => {
    if (selectedPart && topic.part !== selectedPart) return false;
    if (selectedDifficulty && topic.difficulty !== selectedDifficulty) return false;
    if (favoritesOnly && !favoriteTopicIds.has(topic._id)) return false;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const title = (topic.title || "").toLowerCase();
      const desc = (topic.description || "").toLowerCase();
      if (!title.includes(q) && !desc.includes(q)) return false;
    }

    return true;
  });

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
    const isFavorite = favoriteTopicIds.has(topic._id);
    return (
      <Card key={topic.slug}>
        <View style={styles.topicHeaderRow}>
          <View style={styles.topicHeaderLeft}>
            <Text style={styles.topicTitle}>{topic.title}</Text>
            <View style={styles.topicMetaRow}>
              <Text style={styles.topicMeta}>
                Part {topic.part} • {topic.difficulty}
              </Text>
              {topic.isPremium ? <Tag label="Premium" tone="warning" /> : null}
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              if (isOffline) {
                Alert.alert("Offline", "Favorites require an internet connection.");
                return;
              }
              toggleTopicFavorite.mutate({ topicId: topic._id, isFavorite });
            }}
            disabled={isOffline || toggleTopicFavorite.isPending}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={20}
              color={isFavorite ? "#F59E0B" : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.topicDescription}>{topic.description}</Text>
        <Button
          title="Start practice"
          onPress={() => {
            if (!ensureCanStart("practice")) {
              return;
            }
            startSessionMutation.mutate(topic.slug);
          }}
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
    if (topicsQuery.hasNextPage) {
      return (
        <Button
          title="Load more"
          variant="ghost"
          onPress={() => topicsQuery.fetchNextPage()}
          disabled={topicsQuery.isFetchingNextPage}
        />
      );
    }
    return null;
  };

  return (
    <ScreenContainer scrollable>
      <SectionHeading title="Choose a topic">
        Pick an area to practice and receive AI-powered feedback.
      </SectionHeading>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search topics…"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.trim().length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setSearchQuery("")}
            style={styles.clearSearchButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedPart === null && styles.filterChipActive,
          ]}
          onPress={() => setSelectedPart(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedPart === null && styles.filterChipTextActive,
            ]}
          >
            All parts
          </Text>
        </TouchableOpacity>
        {[1, 2, 3].map((part) => (
          <TouchableOpacity
            key={part}
            style={[
              styles.filterChip,
              selectedPart === part && styles.filterChipActive,
            ]}
            onPress={() => setSelectedPart(part as 1 | 2 | 3)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedPart === part && styles.filterChipTextActive,
              ]}
            >
              Part {part}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedDifficulty === null && styles.filterChipActive,
          ]}
          onPress={() => setSelectedDifficulty(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedDifficulty === null && styles.filterChipTextActive,
            ]}
          >
            All levels
          </Text>
        </TouchableOpacity>
        {(["beginner", "intermediate", "advanced"] as const).map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterChip,
              selectedDifficulty === level && styles.filterChipActive,
            ]}
            onPress={() => setSelectedDifficulty(level)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedDifficulty === level && styles.filterChipTextActive,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.filterChip,
            favoritesOnly && styles.filterChipActive,
            { marginLeft: "auto" },
          ]}
          onPress={() => {
            if (isOffline) {
              Alert.alert("Offline", "Favorites require an internet connection.");
              return;
            }
            setFavoritesOnly((v) => !v);
          }}
          disabled={isOffline}
        >
          <View style={styles.filterChipIconRow}>
            <Ionicons
              name={favoritesOnly ? "star" : "star-outline"}
              size={14}
              color={favoritesOnly ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                favoritesOnly && styles.filterChipTextActive,
              ]}
            >
              Favorites
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {topicsQuery.isLoading ? (
        <TopicListSkeleton count={3} />
      ) : filteredTopics.length > 0 ? (
        <>
          {isOffline && cachedTopics.length > 0 && (
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineNoticeText}>
                📚 Showing {cachedTopics.length} cached topics
              </Text>
            </View>
          )}
          <FlatList
            data={filteredTopics}
            renderItem={renderTopicItem}
            keyExtractor={(item) =>
              item._id ? `${item._id}` : `${item.slug}-${item.part}`
            }
            scrollEnabled={false}
            ListFooterComponent={renderTopicsFooter}
          />
        </>
      ) : (
        <EmptyState
          title="No topics available"
          description={
            favoritesOnly
              ? "No favorites match your filters yet."
              : "Check back later for new speaking prompts."
          }
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
            navigation.getParent()?.getParent()?.navigate("Profile" as never);
          }}
        />
      )}
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
  },
  clearSearchButton: {
    padding: 4,
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}14`,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  filterChipIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topicHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  topicHeaderLeft: {
    flex: 1,
  },
  favoriteButton: {
    padding: 6,
    borderRadius: 999,
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
