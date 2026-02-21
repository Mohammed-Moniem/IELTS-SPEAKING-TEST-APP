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
import { useLeaderboard } from "../../hooks";

type Period = "all-time" | "daily" | "weekly" | "monthly";
type Metric = "score" | "practices" | "achievements" | "streak";

const METRIC_ICONS: Record<Metric, keyof typeof Ionicons.glyphMap> = {
  score: "star",
  practices: "book",
  achievements: "trophy",
  streak: "flame",
};

const METRIC_COLORS: Record<Metric, string> = {
  score: "#FFD60A",
  practices: "#007AFF",
  achievements: "#34C759",
  streak: "#FF9500",
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
              index === 0 ? "#FFD60A" : index === 1 ? "#C7C7CC" : "#CD7F32"
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
            color={METRIC_COLORS[metric]}
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
          <Ionicons name="flame" size={16} color="#FF9500" />
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
                color={metric === m ? "#FFFFFF" : METRIC_COLORS[m]}
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
            <Ionicons name="person" size={20} color="#007AFF" />
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
          <Ionicons name="trophy-outline" size={64} color="#C7C7CC" />
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
                tintColor="#007AFF"
              />
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color="#007AFF" />
                </View>
              ) : null
            }
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
  },
  activeTab: {
    backgroundColor: "#007AFF",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  metricSelector: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    gap: 4,
  },
  activeMetricChip: {
    backgroundColor: "#007AFF",
  },
  metricText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
  },
  activeMetricText: {
    color: "#FFFFFF",
  },
  positionCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
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
    color: "#007AFF",
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
    backgroundColor: "#E5E5EA",
  },
  positionLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 4,
  },
  positionRank: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
  },
  positionPercentile: {
    fontSize: 28,
    color: "#34C759",
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
    color: "#000000",
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
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
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentUserItem: {
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  rankContainer: {
    width: 40,
    alignItems: "center",
  },
  rankText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
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
    color: "#000000",
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF9500",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
