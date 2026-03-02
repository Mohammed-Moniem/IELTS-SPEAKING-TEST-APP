import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../theme/tokens";
import { Skeleton } from "../Skeleton";

/**
 * Skeleton loader for achievement cards in AchievementsScreen
 */
export const AchievementCardSkeleton: React.FC = () => (
  <View style={styles.achievementCard}>
    <View style={styles.cardHeader}>
      <Skeleton width={56} height={56} radius={28} />
      <View style={styles.headerContent}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={14} style={styles.subtitle} />
      </View>
      <Skeleton width={48} height={24} radius={12} />
    </View>
    <Skeleton width="100%" height={8} radius={4} style={styles.progressBar} />
    <View style={styles.cardFooter}>
      <Skeleton width="30%" height={12} />
      <Skeleton width="25%" height={12} />
    </View>
  </View>
);

/**
 * Skeleton list for multiple achievement cards
 */
export const AchievementListSkeleton: React.FC<{ count?: number }> = ({
  count = 5,
}) => (
  <View style={styles.listContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <AchievementCardSkeleton key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  listContainer: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  achievementCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerContent: {
    flex: 1,
    gap: spacing.xs,
  },
  subtitle: {
    marginTop: spacing.xxs,
  },
  progressBar: {
    marginTop: spacing.xs,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
});
