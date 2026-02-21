import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../theme/tokens";
import { Skeleton } from "../Skeleton";

/**
 * Skeleton loader for topic cards in PracticeScreen
 */
export const TopicCardSkeleton: React.FC = () => (
  <View style={styles.topicCard}>
    <View style={styles.topicHeader}>
      <Skeleton width="70%" height={20} />
      <View style={styles.topicMetaRow}>
        <Skeleton width="40%" height={14} />
        <Skeleton width={60} height={20} radius={10} style={styles.tag} />
      </View>
    </View>
    <Skeleton width="90%" height={14} style={styles.description} />
    <Skeleton width="100%" height={44} radius={12} style={styles.button} />
  </View>
);

/**
 * Skeleton list for multiple topic cards
 */
export const TopicListSkeleton: React.FC<{ count?: number }> = ({
  count = 3,
}) => (
  <View style={styles.listContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <TopicCardSkeleton key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  listContainer: {
    gap: spacing.md,
  },
  topicCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topicHeader: {
    gap: spacing.xs,
  },
  topicMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tag: {
    marginLeft: spacing.xs,
  },
  description: {
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.sm,
  },
});
