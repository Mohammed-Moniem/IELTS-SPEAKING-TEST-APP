import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

type AchievementDetailScreenRouteProp = RouteProp<
  SocialStackParamList,
  "AchievementDetail"
>;

export const AchievementDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const route = useRoute<AchievementDetailScreenRouteProp>();
  const { achievementId } = route.params;

  // Mock achievement data - in real app, fetch from API
  const achievement = {
    icon: "🎯",
    name: "First Steps",
    description: "Complete your first practice session",
    points: 50,
    category: "PRACTICE",
    progress: 100,
    requirement: 1,
    isUnlocked: true,
    unlockedAt: new Date().toISOString(),
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{achievement.icon}</Text>
        <Text style={styles.name}>{achievement.name}</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>+{achievement.points} XP</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{achievement.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${achievement.progress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {achievement.progress}% Complete
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Requirement</Text>
        <Text style={styles.requirement}>
          {achievement.requirement} {achievement.category.toLowerCase()}{" "}
          session(s)
        </Text>
      </View>

      {achievement.isUnlocked && (
        <View style={styles.unlockedSection}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={styles.unlockedTitle}>Achievement Unlocked!</Text>
          <Text style={styles.unlockedDate}>
            {new Date(achievement.unlockedAt).toLocaleDateString()}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundMuted,
    },
    header: {
      backgroundColor: colors.surface,
      alignItems: "center",
      padding: spacing.xxl,
    },
    icon: {
      fontSize: 80,
      marginBottom: spacing.md,
    },
    name: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    pointsBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      borderRadius: 20,
    },
    pointsText: {
      color: colors.primaryOn,
      fontSize: 17,
      fontWeight: "700",
    },
    section: {
      backgroundColor: colors.surface,
      padding: spacing.xl,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: 17,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    progressContainer: {
      gap: spacing.sm,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.borderMuted,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.success,
    },
    progressText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    requirement: {
      fontSize: 17,
      color: colors.textPrimary,
    },
    unlockedSection: {
      alignItems: "center",
      padding: spacing.xxl,
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
    },
    unlockedTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.success,
      marginTop: spacing.md,
    },
    unlockedDate: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
