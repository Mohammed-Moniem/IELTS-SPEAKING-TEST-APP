import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAchievements } from "../../hooks";
import type { AchievementCategory } from "../../services/api/achievementService";

export const AchievementsScreen: React.FC = () => {
  const { achievements, loading, loadProgress } = useAchievements();
  const [filter, setFilter] = useState<AchievementCategory>("all");

  useEffect(() => {
    loadProgress();
  }, []);

  const filteredAchievements = achievements.filter(
    (a) => filter === "all" || a.category === filter
  );

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const totalPoints = achievements
    .filter((a) => a.isUnlocked)
    .reduce((sum, a) => sum + a.points, 0);

  const categories: AchievementCategory[] = [
    "all",
    "PRACTICE",
    "IMPROVEMENT",
    "STREAK",
    "SOCIAL",
    "MILESTONE",
  ];

  const renderAchievement = ({ item }: { item: any }) => (
    <View
      style={[styles.achievementCard, !item.isUnlocked && styles.lockedCard]}
    >
      <View style={styles.achievementIcon}>
        <Text style={styles.iconText}>{item.icon}</Text>
        {!item.isUnlocked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={24} color="#8E8E93" />
          </View>
        )}
      </View>

      <View style={styles.achievementInfo}>
        <Text
          style={[
            styles.achievementName,
            !item.isUnlocked && styles.lockedText,
          ]}
        >
          {item.name}
        </Text>
        <Text style={styles.achievementDescription}>{item.description}</Text>

        {!item.isUnlocked && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(item.progress / item.requirement.value) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {item.progress}/{item.requirement.value}
            </Text>
          </View>
        )}

        <View style={styles.achievementFooter}>
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={14} color="#FFD60A" />
            <Text style={styles.pointsText}>{item.points} pts</Text>
          </View>
          {item.isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.header}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {unlockedCount}/{achievements.length}
          </Text>
          <Text style={styles.statLabel}>Unlocked</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalPoints}</Text>
          <Text style={styles.statLabel}>Total Points</Text>
        </View>
      </View>

      {/* Category Filters */}
      <FlatList
        horizontal
        data={categories}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === item && styles.activeFilterChip,
            ]}
            onPress={() => setFilter(item)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.activeFilterText,
              ]}
            >
              {item === "all"
                ? "All"
                : item.charAt(0) + item.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filtersList}
        showsHorizontalScrollIndicator={false}
      />

      {/* Achievements List */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={filteredAchievements}
          renderItem={renderAchievement}
          keyExtractor={(item) => item._id}
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
  header: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 4,
  },
  filtersList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: "#007AFF",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  activeFilterText: {
    color: "#FFFFFF",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  achievementCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lockedCard: {
    opacity: 0.6,
  },
  achievementIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    position: "relative",
  },
  iconText: {
    fontSize: 32,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
  },
  lockedText: {
    color: "#8E8E93",
  },
  achievementDescription: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E5EA",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },
  achievementFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFD60A",
  },
  premiumBadge: {
    backgroundColor: "#5856D6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
