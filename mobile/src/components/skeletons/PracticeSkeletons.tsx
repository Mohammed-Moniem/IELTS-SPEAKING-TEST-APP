import React from "react";
import { StyleSheet, View } from "react-native";

import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";
import { Skeleton } from "../Skeleton";

/**
 * Skeleton loader for topic cards in PracticeScreen.
 * Mirrors the final card hierarchy to reduce layout jank on load.
 */
export const TopicCardSkeleton: React.FC = () => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.topicCard}>
      <View style={styles.topicHeader}>
        <Skeleton width="72%" height={22} />
        <View style={styles.topicMetaRow}>
          <Skeleton width={130} height={14} />
          <Skeleton width={84} height={24} radius={12} />
        </View>
        <Skeleton width="68%" height={13} />
      </View>

      <Skeleton width="92%" height={14} style={styles.description} />

      <View style={styles.expectationsBlock}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="72%" height={13} />
      </View>

      <Skeleton width="100%" height={48} radius={radii.xl} style={styles.button} />
    </View>
  );
};

/**
 * Skeleton list for multiple topic cards.
 */
export const TopicListSkeleton: React.FC<{ count?: number }> = ({
  count = 3,
}) => (
  <View style={stylesList.listContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <TopicCardSkeleton key={index} />
    ))}
  </View>
);

const stylesList = StyleSheet.create({
  listContainer: {
    gap: spacing.md,
  },
});

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    topicCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xxl,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: spacing.md,
      gap: spacing.md,
      marginVertical: spacing.xs,
    },
    topicHeader: {
      gap: spacing.xs,
    },
    topicMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    description: {
      marginTop: spacing.xs,
    },
    expectationsBlock: {
      gap: spacing.xs,
    },
    button: {
      marginTop: spacing.xs,
    },
  });
