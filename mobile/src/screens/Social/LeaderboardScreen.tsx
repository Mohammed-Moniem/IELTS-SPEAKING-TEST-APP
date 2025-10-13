import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLeaderboard } from "../../hooks";

type Period = "all-time" | "daily" | "weekly" | "monthly";
type Metric = "score" | "practices" | "achievements" | "streak";

export const LeaderboardScreen: React.FC = () => {
  const {
    leaderboard,
    userPosition,
    loading,
    loadLeaderboard,
    loadUserPosition,
  } = useLeaderboard();
  const [period, setPeriod] = useState<Period>("all-time");
  const [metric, setMetric] = useState<Metric>("score");

  useEffect(() => {
    loadLeaderboard(period, metric, 100);
    loadUserPosition(period, metric);
  }, [period, metric]);

  const renderLeaderboardItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => (
    <View style={styles.leaderboardItem}>
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
            item.userId.avatar ||
            `https://ui-avatars.com/api/?name=${item.userId.username}`,
        }}
        style={styles.avatar}
      />

      <View style={styles.userInfo}>
        <Text style={styles.username}>
          {item.userId.username || item.userId.email}
        </Text>
        <Text style={styles.scoreText}>{item.score} points</Text>
      </View>

      {item.currentStreak && (
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={16} color="#FF9500" />
          <Text style={styles.streakText}>{item.currentStreak}</Text>
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
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* User Position Card */}
      {userPosition && (
        <View style={styles.positionCard}>
          <Text style={styles.positionTitle}>Your Rank</Text>
          <Text style={styles.positionRank}>#{userPosition.rank}</Text>
          <Text style={styles.positionPercentile}>
            Top {userPosition.percentile.toFixed(1)}%
          </Text>
        </View>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item, index) => `${item.userId._id}-${index}`}
          contentContainerStyle={styles.list}
        />
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
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#F2F2F7",
  },
  activeTab: {
    backgroundColor: "#007AFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  positionCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  positionTitle: {
    fontSize: 14,
    color: "#8E8E93",
  },
  positionRank: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#007AFF",
    marginVertical: 4,
  },
  positionPercentile: {
    fontSize: 16,
    color: "#34C759",
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
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
  },
  scoreText: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
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
});
