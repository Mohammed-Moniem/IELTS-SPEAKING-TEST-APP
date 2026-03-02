import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LeaderboardSkeleton } from "../../components/skeletons/SocialSkeletons";
import { useTheme } from "../../context";
import { useLeaderboard, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

type Period = "all-time" | "daily" | "weekly" | "monthly";
type Metric = "score" | "practices" | "achievements" | "streak";

const METRIC_ICONS: Record<Metric, keyof typeof Ionicons.glyphMap> = {
  score: "star",
  practices: "book",
  achievements: "trophy",
  streak: "flame",
};

export const LeaderboardScreen: React.FC = () => {
  const {
    leaderboard,
    userPosition,
    loading,
    loadingMore,
    hasMore,
    loadLeaderboard,
    loadUserPosition,
  } = useLeaderboard();
  const [period, setPeriod] = useState<Period>("all-time");
  const [metric, setMetric] = useState<Metric>("score");
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, [period, metric]);

  useEffect(() => {
    // Fade in animation when data loads
    if (!loading && leaderboard.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, leaderboard]);

  const isInitialLoading = loading && leaderboard.length === 0;

  const loadData = async () => {
    await loadLeaderboard(period, metric, 50, false);
    await loadUserPosition(period, metric);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadLeaderboard(period, metric, 50, true);
    }
  };

  const getMetricColor = (metricName: Metric): string => {
    if (metricName === "score") return colors.warning;
    if (metricName === "practices") return colors.primary;
    if (metricName === "achievements") return colors.success;
    return colors.warning;
  };

  const renderLeaderboardItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => (
    <View
      style={[
        styles.leaderboardItem,
        item.isCurrentUser && styles.currentUserItem,
      ]}
    >
      <View style={styles.rankContainer}>
        {index < 3 ? (
          <Ionicons
            name="trophy"
            size={24}
            color={
              index === 0
                ? colors.tierGold
                : index === 1
                ? colors.tierSilver
                : colors.tierBronze
            }
          />
        ) : (
          <Text style={styles.rankText}>{item.rank}</Text>
        )}
      </View>

      <Image
        source={{
          uri:
            item.avatar ||
            `https://ui-avatars.com/api/?name=${item.username || "User"}`,
        }}
        style={styles.avatar}
      />

      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username || "Anonymous"}</Text>
        <View style={styles.statsRow}>
          <Ionicons
            name={METRIC_ICONS[metric]}
            size={14}
            color={getMetricColor(metric)}
          />
          <Text style={styles.scoreText}>
            {metric === "score"
              ? `${item.score.toFixed(1)} pts`
              : metric === "practices"
              ? `${item.totalSessions} sessions`
              : metric === "achievements"
              ? `${item.achievements} unlocked`
              : `${item.streak} day streak`}
          </Text>
        </View>
      </View>

      {item.streak > 0 && metric !== "streak" && (
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={16} color={colors.warning} />
          <Text style={styles.streakText}>{item.streak}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Period Tabs */}
      <View style={styles.tabs}>
        {(["all-time", "weekly", "monthly", "daily"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.tab, period === p && styles.activeTab]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[styles.tabText, period === p && styles.activeTabText]}
            >
              {p === "all-time"
                ? "All Time"
                : p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metric Selector */}
      <View style={styles.metricSelector}>
        {(["score", "practices", "achievements", "streak"] as Metric[]).map(
          (m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.metricChip,
                metric === m && styles.activeMetricChip,
              ]}
              onPress={() => setMetric(m)}
            >
              <Ionicons
                name={METRIC_ICONS[m]}
                size={16}
                color={metric === m ? colors.primaryOn : getMetricColor(m)}
              />
              <Text
                style={[
                  styles.metricText,
                  metric === m && styles.activeMetricText,
                ]}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* User Position Card */}
      {userPosition && !loading && (
        <View style={styles.positionCard}>
          <View style={styles.positionHeader}>
            <Ionicons name="person" size={20} color={colors.primary} />
            <Text style={styles.positionTitle}>Your Position</Text>
          </View>
          <View style={styles.positionStats}>
            <View style={styles.positionStatItem}>
              <Text style={styles.positionLabel}>Rank</Text>
              <Text style={styles.positionRank}>#{userPosition.rank}</Text>
            </View>
            <View style={styles.positionDivider} />
            <View style={styles.positionStatItem}>
              <Text style={styles.positionLabel}>Percentile</Text>
              <Text style={styles.positionPercentile}>
                Top {userPosition.percentile.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Loading State */}
      {isInitialLoading ? (
        <LeaderboardSkeleton />
      ) : leaderboard.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Rankings Yet</Text>
          <Text style={styles.emptyText}>
            Complete more practices to appear on the leaderboard
          </Text>
        </View>
      ) : (
        /* Leaderboard List */
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={leaderboard}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item, index) => `${item.userId}-${index}`}
            contentContainerStyle={styles.list}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null
            }
          />
        </Animated.View>
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundMuted,
    },
    tabs: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    activeTabText: {
      color: colors.primaryOn,
    },
    metricSelector: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    metricChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
      gap: 4,
    },
    activeMetricChip: {
      backgroundColor: colors.primary,
    },
    metricText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    activeMetricText: {
      color: colors.primaryOn,
    },
    positionCard: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 16,
      borderRadius: 12,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    positionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    positionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
    },
    positionStats: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },
    positionStatItem: {
      flex: 1,
      alignItems: "center",
    },
    positionDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.divider,
    },
    positionLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    positionRank: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.primary,
    },
    positionPercentile: {
      fontSize: 28,
      color: colors.success,
      fontWeight: "bold",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      gap: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: "center",
    },
    list: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    leaderboardItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    currentUserItem: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.statusInfoBackground,
    },
    rankContainer: {
      width: 40,
      alignItems: "center",
    },
    rankText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginHorizontal: 12,
    },
    userInfo: {
      flex: 1,
    },
    username: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    scoreText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    streakText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.warning,
    },
    footerLoader: {
      paddingVertical: 20,
      alignItems: "center",
    },
  });
