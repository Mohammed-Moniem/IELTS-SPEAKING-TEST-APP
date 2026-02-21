import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AchievementProgressCard } from "../../components/AchievementProgressCard";
import { AchievementListSkeleton } from "../../components/skeletons/AchievementSkeletons";
import { useTheme } from "../../context";
import { useAchievements, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import type { AchievementCategory } from "../../services/api/achievementService";

type TabType = "all" | "unlocked" | "locked";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  PRACTICE: "Practice",
  IMPROVEMENT: "Improvement",
  STREAK: "Streak",
  SOCIAL: "Social",
  MILESTONE: "Milestone",
};

export const AchievementsScreen: React.FC = () => {
  const {
    achievements,
    loading,
    loadProgress,
    newlyUnlocked,
    clearNewlyUnlocked,
  } = useAchievements();
  const [selectedTab, setSelectedTab] = useState<TabType>("all");
  const [filter, setFilter] = useState<AchievementCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const heroGradient = useMemo(
    () =>
      [
        colors.primary,
        colors.primaryStrong ?? colors.primary,
      ] as const,
    [colors]
  );

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProgress();
    setRefreshing(false);
  };

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const totalPoints = achievements
    .filter((a) => a.isUnlocked)
    .reduce((sum, a) => sum + a.points, 0);

  const segments = useMemo(
    () => [
      { key: "all" as TabType, label: "All", count: achievements.length },
      {
        key: "unlocked" as TabType,
        label: "Unlocked",
        count: unlockedCount,
      },
      {
        key: "locked" as TabType,
        label: "Locked",
        count: achievements.length - unlockedCount,
      },
    ],
    [achievements.length, unlockedCount]
  );

  const categories: AchievementCategory[] = [
    "all",
    "PRACTICE",
    "IMPROVEMENT",
    "STREAK",
    "SOCIAL",
    "MILESTONE",
  ];

  const filteredAchievements = achievements
    .filter((achievement) => {
      if (selectedTab === "unlocked") return achievement.isUnlocked;
      if (selectedTab === "locked") return !achievement.isUnlocked;
      return true;
    })
    .filter((achievement) => filter === "all" || achievement.category === filter)
    .filter((achievement) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        achievement.name.toLowerCase().includes(query) ||
        achievement.description.toLowerCase().includes(query)
      );
    });

  const renderAchievement = ({ item }: { item: any }) => (
    <View style={styles.achievementItemWrapper}>
      <AchievementProgressCard achievement={item} />
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.headerSection}>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroTitle}>Achievements</Text>
            <Text style={styles.heroSubtitle}>
              Your progress across practice, streaks, and milestones
            </Text>
          </View>
          <Ionicons name="trophy" size={40} color={colors.warning} />
        </View>

        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Unlocked</Text>
            <Text style={styles.heroMetricValue}>{unlockedCount}</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Available</Text>
            <Text style={styles.heroMetricValue}>{achievements.length}</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Points Earned</Text>
            <Text style={styles.heroMetricValue}>{totalPoints}</Text>
          </View>
        </View>
      </LinearGradient>

      {newlyUnlocked && (
        <View style={styles.newlyUnlockedCard}>
          <Ionicons name="sparkles" size={20} color={colors.success} />
          <Text style={styles.newlyUnlockedText}>
            {`Unlocked: ${newlyUnlocked.name}`}
          </Text>
          <TouchableOpacity
            style={styles.dismissPill}
            onPress={clearNewlyUnlocked}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.segmentContainer}>
        {segments.map((segment) => {
          const isActive = selectedTab === segment.key;
          return (
            <TouchableOpacity
              key={segment.key}
              style={[
                styles.segmentButton,
                isActive && styles.activeSegment,
              ]}
              onPress={() => setSelectedTab(segment.key)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  isActive && styles.activeSegmentLabel,
                ]}
              >
                {segment.label} ({segment.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search achievements"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== "" && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {categories.map((category) => {
          const isActive = filter === category;
          const label = CATEGORY_LABELS[category] ?? category;
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.chip,
                isActive && styles.activeChip,
              ]}
              onPress={() => setFilter(category)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  isActive && styles.activeChipText,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && achievements.length === 0 && (
        <View style={styles.skeletonWrapper}>
          <AchievementListSkeleton count={4} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={loading && achievements.length === 0 ? [] : filteredAchievements}
        renderItem={renderAchievement}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf" size={32} color={colors.textMuted} />
              <Text style={styles.emptyStateTitle}>No achievements yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Complete practice sessions and challenges to unlock rewards.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingBottom: 32,
    },
    headerSection: {
      paddingBottom: 16,
    },
    heroCard: {
      borderRadius: 24,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 20,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroTitle: {
      color: colors.primaryOn,
      fontSize: 22,
      fontWeight: "700",
    },
    heroSubtitle: {
      color: colors.primaryOn,
      marginTop: 6,
      fontSize: 13,
      opacity: 0.8,
    },
    heroMetricsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 20,
    },
    heroMetric: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 12,
    },
    heroMetricLabel: {
      color: colors.primaryOn,
      opacity: 0.75,
      fontSize: 12,
      fontWeight: "500",
    },
    heroMetricValue: {
      color: colors.primaryOn,
      fontSize: 24,
      fontWeight: "700",
      marginTop: 6,
    },
    newlyUnlockedCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.successSoft,
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    newlyUnlockedText: {
      flex: 1,
      color: colors.success,
      fontWeight: "600",
    },
    dismissPill: {
      backgroundColor: colors.successSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    dismissText: {
      color: colors.success,
      fontWeight: "600",
      fontSize: 12,
    },
    segmentContainer: {
      flexDirection: "row",
      backgroundColor: colors.surfaceSubtle,
      marginTop: 20,
      marginHorizontal: 16,
      borderRadius: 24,
      padding: 4,
    },
    segmentButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 20,
    },
    activeSegment: {
      backgroundColor: colors.primary,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    activeSegmentLabel: {
      color: colors.primaryOn,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginTop: 18,
      paddingHorizontal: 14,
      borderRadius: 14,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    searchInput: {
      flex: 1,
      height: 42,
      fontSize: 15,
      color: colors.textPrimary,
    },
    chipsScroll: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
      marginRight: 10,
    },
    activeChip: {
      backgroundColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    activeChipText: {
      color: colors.primaryOn,
    },
    skeletonWrapper: {
      marginTop: 16,
      paddingHorizontal: 16,
    },
    achievementItemWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    emptyState: {
      alignItems: "center",
      marginTop: 48,
      paddingHorizontal: 32,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: 16,
    },
    emptyStateSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
    },
  });
