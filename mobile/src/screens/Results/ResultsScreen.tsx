import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
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

import { favoritesApi, practiceApi, simulationApi } from "../../api/services";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import type { PracticeSession, TestSimulation } from "../../types/api";

type TabType = "practice" | "simulation";
type FilterType = "all" | "completed" | "in-progress";
type SortType = "date-desc" | "date-asc" | "score-desc" | "score-asc";

const getBandColor = (band: number): string => {
  if (band >= 8) return "#10b981"; // Green
  if (band >= 7) return "#3b82f6"; // Blue
  if (band >= 6) return "#f59e0b"; // Orange
  if (band >= 5) return "#ef4444"; // Red
  return "#6b7280"; // Gray
};

export const ResultsScreen = () => {
  const [activeTab, setActiveTab] = useState<TabType>("practice");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("date-desc");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isOffline } = useNetworkStatus();

  const practiceResults = useQuery({
    queryKey: ["practice-results"],
    queryFn: () => practiceApi.listSessions({ limit: 100, offset: 0 }),
  });

  const simulationResults = useQuery({
    queryKey: ["simulation-results"],
    queryFn: () => simulationApi.list({ limit: 50, offset: 0 }),
  });

  const favoritePracticeQuery = useQuery({
    queryKey: ["favorites", "practice_session"],
    queryFn: () => favoritesApi.list("practice_session"),
    enabled: !isOffline,
  });

  const favoriteSimulationQuery = useQuery({
    queryKey: ["favorites", "test_simulation"],
    queryFn: () => favoritesApi.list("test_simulation"),
    enabled: !isOffline,
  });

  const practiceFavoriteIds = useMemo(
    () => new Set<string>(favoritePracticeQuery.data ?? []),
    [favoritePracticeQuery.data]
  );

  const simulationFavoriteIds = useMemo(
    () => new Set<string>(favoriteSimulationQuery.data ?? []),
    [favoriteSimulationQuery.data]
  );

  const toggleFavorite = useMutation({
    mutationFn: async (payload: {
      entityType: "practice_session" | "test_simulation";
      entityId: string;
      isFavorite: boolean;
    }) => {
      if (payload.isFavorite) {
        await favoritesApi.remove(payload.entityType, payload.entityId);
        return;
      }
      await favoritesApi.add({
        entityType: payload.entityType,
        entityId: payload.entityId,
      });
    },
    onSuccess: (_data, vars) => {
      queryClient
        .invalidateQueries({ queryKey: ["favorites", vars.entityType] })
        .catch(() => undefined);
    },
    onError: (error) => {
      Alert.alert(
        "Unable to update favorite",
        (error as any)?.message || "Please try again."
      );
    },
  });

  const practiceData = (practiceResults.data || []) as PracticeSession[];
  const simulationData = (simulationResults.data || []) as TestSimulation[];

  const filteredPracticeData = useMemo(() => {
    let filtered = [...practiceData];

    if (filter === "completed") {
      filtered = filtered.filter((item) => item.status === "completed" && item.feedback);
    } else if (filter === "in-progress") {
      filtered = filtered.filter((item) => item.status !== "completed");
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((item) => {
        const topic = (item.topicTitle || "").toLowerCase();
        const question = (item.question || "").toLowerCase();
        return topic.includes(q) || question.includes(q);
      });
    }

    if (favoritesOnly) {
      filtered = filtered.filter((item) =>
        practiceFavoriteIds.has(String(item._id))
      );
    }

    filtered.sort((a, b) => {
      const aDate = new Date(a.completedAt || a.createdAt).getTime();
      const bDate = new Date(b.completedAt || b.createdAt).getTime();
      const aBand = Number(a.feedback?.overallBand || 0);
      const bBand = Number(b.feedback?.overallBand || 0);

      switch (sortBy) {
        case "date-asc":
          return aDate - bDate;
        case "score-desc":
          return bBand - aBand;
        case "score-asc":
          return aBand - bBand;
        case "date-desc":
        default:
          return bDate - aDate;
      }
    });

    return filtered;
  }, [practiceData, filter, favoritesOnly, practiceFavoriteIds, searchQuery, sortBy]);

  const filteredSimulationData = useMemo(() => {
    let filtered = [...simulationData];

    if (filter === "completed") {
      filtered = filtered.filter((item) => item.status === "completed");
    } else if (filter === "in-progress") {
      filtered = filtered.filter((item) => item.status !== "completed");
    }

    if (favoritesOnly) {
      filtered = filtered.filter((item) =>
        simulationFavoriteIds.has(String(item._id))
      );
    }

    filtered.sort((a, b) => {
      const aDate = new Date(a.completedAt || a.createdAt).getTime();
      const bDate = new Date(b.completedAt || b.createdAt).getTime();
      const aBand = Number(a.overallBand || 0);
      const bBand = Number(b.overallBand || 0);

      switch (sortBy) {
        case "date-asc":
          return aDate - bDate;
        case "score-desc":
          return bBand - aBand;
        case "score-asc":
          return aBand - bBand;
        case "date-desc":
        default:
          return bDate - aDate;
      }
    });

    return filtered;
  }, [simulationData, filter, favoritesOnly, simulationFavoriteIds, sortBy]);

  const isLoading = activeTab === "practice" ? practiceResults.isLoading : simulationResults.isLoading;

  const renderPracticeItem = ({ item }: { item: PracticeSession }) => {
    const hasCompleted = item.status === "completed" && !!item.feedback;
    const band = Number(item.feedback?.overallBand || 0);
    const isVoice = item.source === "voice";
    const isFavorite = practiceFavoriteIds.has(String(item._id));

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => {
          if (hasCompleted) {
            navigation.navigate("Practice", {
              screen: "PracticeResultDetail",
              params: { sessionId: item._id },
            });
            return;
          }

          if (item.status === "in_progress") {
            Alert.alert("Resume Session", "Would you like to continue this practice session?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Resume",
                onPress: () => {
                  navigation.navigate("Practice", {
                    screen: "PracticeSession",
                    params: {
                      session: {
                        sessionId: item._id,
                        topic: {
                          id: item.topicId,
                          title: item.topicTitle || "Practice Session",
                          slug: "",
                          part: item.part,
                          category: item.category || `part${item.part}`,
                          difficulty: item.difficulty || "medium",
                          question: item.question,
                        },
                      },
                    },
                  });
                },
              },
            ]);
          }
        }}
        activeOpacity={0.8}
      >
        <View style={styles.resultHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.topicTitle} numberOfLines={2}>
              {item.topicTitle || "Practice Session"}
            </Text>
            {isVoice ? (
              <View style={styles.voiceBadge}>
                <Ionicons name="mic" size={14} color="#0F766E" />
                <Text style={styles.voiceBadgeText}>Voice</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                if (isOffline) {
                  Alert.alert("Offline", "Favorites require an internet connection.");
                  return;
                }
                toggleFavorite.mutate({
                  entityType: "practice_session",
                  entityId: String(item._id),
                  isFavorite,
                });
              }}
              disabled={isOffline || toggleFavorite.isPending}
              style={styles.starButton}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={18}
                color={isFavorite ? "#F59E0B" : colors.textMuted}
              />
            </TouchableOpacity>
            {hasCompleted ? (
              <View style={[styles.bandBadge, { backgroundColor: getBandColor(band) }]}>
                <Text style={styles.bandText}>{band.toFixed(1)}</Text>
              </View>
            ) : (
              <View style={[styles.bandBadge, styles.inProgressBadge]}>
                <Text style={styles.badgeText}>Resume</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.metaText}>
          Part {item.part}
          {item.difficulty ? ` • ${item.difficulty}` : ""}
        </Text>

        <Text style={styles.dateText}>
          {new Date(item.completedAt || item.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSimulationItem = ({ item }: { item: TestSimulation }) => {
    const band = Number(item.overallBand || 0);
    const hasCompleted = item.status === "completed";
    const isFavorite = simulationFavoriteIds.has(String(item._id));
    return (
      <TouchableOpacity
        style={styles.resultCard}
        disabled={!hasCompleted}
        onPress={() => {
          if (!hasCompleted) return;
          navigation.navigate("Simulations", {
            screen: "SimulationDetail",
            params: { simulation: item },
          });
        }}
        activeOpacity={0.8}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.topicTitle} numberOfLines={2}>
            Full Simulation
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                if (isOffline) {
                  Alert.alert("Offline", "Favorites require an internet connection.");
                  return;
                }
                toggleFavorite.mutate({
                  entityType: "test_simulation",
                  entityId: String(item._id),
                  isFavorite,
                });
              }}
              disabled={isOffline || toggleFavorite.isPending}
              style={styles.starButton}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={18}
                color={isFavorite ? "#F59E0B" : colors.textMuted}
              />
            </TouchableOpacity>
            {hasCompleted ? (
              <View style={[styles.bandBadge, { backgroundColor: getBandColor(band) }]}>
                <Text style={styles.bandText}>{band.toFixed(1)}</Text>
              </View>
            ) : (
              <View style={[styles.bandBadge, styles.inProgressBadge]}>
                <Text style={styles.badgeText}>In progress</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.metaText}>{item.parts?.length || 3} parts</Text>

        <Text style={styles.dateText}>
          {new Date(item.completedAt || item.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  const data = activeTab === "practice" ? filteredPracticeData : filteredSimulationData;

  return (
    <ScreenContainer>
      <SectionHeading title="Your results">Review feedback and track your progress.</SectionHeading>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "practice" && styles.activeTab]}
          onPress={() => setActiveTab("practice")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="book-outline"
            size={18}
            color={activeTab === "practice" ? "#FFFFFF" : colors.primary}
          />
          <Text style={[styles.tabText, activeTab === "practice" && styles.activeTabText]}>Practice</Text>
          <View style={[styles.badge, activeTab === "practice" && styles.badgeActive]}>
            <Text style={styles.badgeText}>{practiceData.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "simulation" && styles.activeTab]}
          onPress={() => setActiveTab("simulation")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="trophy-outline"
            size={18}
            color={activeTab === "simulation" ? "#FFFFFF" : colors.primary}
          />
          <Text style={[styles.tabText, activeTab === "simulation" && styles.activeTabText]}>Simulations</Text>
          <View style={[styles.badge, activeTab === "simulation" && styles.badgeActive]}>
            <Text style={styles.badgeText}>{simulationData.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === "practice" ? (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search topics or questions…"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === "all" && styles.filterChipActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterChipText, filter === "all" && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === "completed" && styles.filterChipActive]}
          onPress={() => setFilter("completed")}
        >
          <Text style={[styles.filterChipText, filter === "completed" && styles.filterChipTextActive]}>Completed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === "in-progress" && styles.filterChipActive]}
          onPress={() => setFilter("in-progress")}
        >
          <Text style={[styles.filterChipText, filter === "in-progress" && styles.filterChipTextActive]}>In progress</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, favoritesOnly && styles.filterChipActive]}
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

        <TouchableOpacity
          style={styles.sortChip}
          onPress={() => {
            const next: SortType =
              sortBy === "date-desc"
                ? "score-desc"
                : sortBy === "score-desc"
                ? "date-asc"
                : sortBy === "date-asc"
                ? "score-asc"
                : "date-desc";
            setSortBy(next);
          }}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
          <Text style={styles.sortChipText}>
            {sortBy.startsWith("date") ? "Date" : "Score"}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => String(item._id)}
          renderItem={activeTab === "practice" ? (renderPracticeItem as any) : (renderSimulationItem as any)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No results yet</Text>
              <Text style={styles.emptyText}>Complete a practice or simulation to see it here.</Text>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    center: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xl,
    },
    loadingText: {
      marginTop: spacing.sm,
      color: colors.textMuted,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center",
    },
    tabContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
    },
    activeTab: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      flex: 1,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    activeTabText: {
      color: "#FFFFFF",
    },
    badge: {
      minWidth: 26,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceSubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textPrimary,
    },
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
    filterRow: {
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
    },
    filterChipTextActive: {
      color: colors.primary,
    },
    filterChipIconRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    sortChip: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    sortChipText: {
      color: colors.textSecondary,
      fontWeight: "700",
      fontSize: 12,
    },
    listContent: {
      paddingBottom: spacing.xxl,
    },
    resultCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    starButton: {
      padding: 6,
      borderRadius: 999,
    },
    titleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    topicTitle: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    metaText: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    dateText: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontSize: 12,
    },
    bandBadge: {
      minWidth: 56,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    bandText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 13,
    },
    inProgressBadge: {
      backgroundColor: colors.backgroundMuted,
    },
    voiceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "#CCFBF1",
    },
    voiceBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#0F766E",
    },
  });
