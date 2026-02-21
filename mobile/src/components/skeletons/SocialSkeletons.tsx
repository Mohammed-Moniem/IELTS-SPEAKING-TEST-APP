import React from "react";
import { StyleSheet, View } from "react-native";

import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { Skeleton } from "../Skeleton";

export const ConversationSkeletonList: React.FC<{
  count?: number;
}> = ({ count = 6 }) => {
  const styles = useSocialSkeletonStyles();
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.conversationRow}>
          <Skeleton width={56} height={56} radius={28} />
          <View style={styles.conversationContent}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={12} style={styles.conversationSub} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const FriendSkeletonList: React.FC<{
  count?: number;
}> = ({ count = 5 }) => {
  const styles = useSocialSkeletonStyles();
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.friendRow}>
          <Skeleton width={52} height={52} radius={26} />
          <View style={styles.friendContent}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} style={styles.friendSub} />
          </View>
          <Skeleton width={36} height={36} radius={12} />
        </View>
      ))}
    </View>
  );
};

export const LeaderboardSkeleton: React.FC<{ count?: number }> = ({
  count = 8,
}) => {
  const styles = useSocialSkeletonStyles();
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.leaderboardRow}>
          <Skeleton width={28} height={28} radius={14} />
          <Skeleton
            width={48}
            height={48}
            radius={24}
            style={styles.leaderboardAvatar}
          />
          <View style={styles.leaderboardContent}>
            <Skeleton width="65%" height={14} />
            <Skeleton width="40%" height={12} style={styles.leaderboardSub} />
          </View>
          <Skeleton width={56} height={20} radius={10} />
        </View>
      ))}
    </View>
  );
};

export const SocialDashboardSkeleton: React.FC = () => {
  const styles = useSocialSkeletonStyles();
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Skeleton width="40%" height={28} />
          <Skeleton width="55%" height={16} style={styles.dashboardSub} />
        </View>
        <Skeleton width={40} height={40} radius={20} />
      </View>

      <View style={styles.statsRow}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles.statCard}>
            <Skeleton width={28} height={28} radius={14} />
            <Skeleton width="50%" height={20} style={styles.statNumber} />
            <Skeleton width="60%" height={12} />
          </View>
        ))}
      </View>

      <View style={styles.sectionBlock}>
        <Skeleton width="30%" height={18} />
        <Skeleton width="80%" height={14} style={styles.sectionSub} />
      </View>

      <View style={styles.actionGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles.actionCard}>
            <Skeleton width={36} height={36} radius={18} />
            <Skeleton width="70%" height={14} style={styles.actionText} />
          </View>
        ))}
      </View>

      <View style={styles.sectionBlock}>
        <Skeleton width="35%" height={18} />
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles.featureRow}>
            <Skeleton width={44} height={44} radius={22} />
            <View style={styles.featureContent}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="45%" height={12} style={styles.featureSub} />
            </View>
            <Skeleton width={24} height={24} radius={12} />
          </View>
        ))}
      </View>
    </View>
  );
};

const useSocialSkeletonStyles = () => useThemedStyles(createStyles);

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    gap: spacing.md,
  },
  conversationContent: {
    flex: 1,
    gap: spacing.xs,
  },
  conversationSub: {
    marginTop: spacing.xs / 2,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 16,
  },
  friendContent: {
    flex: 1,
    marginHorizontal: spacing.md,
    gap: spacing.xs,
  },
  friendSub: {
    marginTop: spacing.xs / 2,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    gap: spacing.md,
  },
  leaderboardAvatar: {
    marginLeft: spacing.xs,
  },
  leaderboardContent: {
    flex: 1,
    gap: spacing.xs,
  },
  leaderboardSub: {
    marginTop: spacing.xs / 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  dashboardSub: {
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  statNumber: {
    marginTop: spacing.xs,
  },
  sectionBlock: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  sectionSub: {
    marginTop: spacing.xs,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionCard: {
    width: "48%",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  actionText: {
    marginTop: spacing.xs,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  featureContent: {
    flex: 1,
    gap: spacing.xs,
  },
  featureSub: {
    marginTop: spacing.xs / 2,
  },
});
