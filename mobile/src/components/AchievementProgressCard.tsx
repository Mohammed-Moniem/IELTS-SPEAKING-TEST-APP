import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";

interface AchievementProgressCardProps {
  achievement: {
    _id: string;
    key: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    category: string;
    isPremium: boolean;
    requirement: {
      type: string;
      value: number;
    };
    userProgress?: {
      progress: number;
      isUnlocked: boolean;
      unlockedAt?: Date;
    };
  };
  onPress?: () => void;
}

export const AchievementProgressCard: React.FC<
  AchievementProgressCardProps
> = ({ achievement, onPress }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isUnlocked = achievement.userProgress?.isUnlocked || false;
  const progress = achievement.userProgress?.progress || 0;
  const progressPercentage = (progress / achievement.requirement.value) * 100;

  useEffect(() => {
    // Animate progress bar on mount or when progress changes
    Animated.spring(progressAnim, {
      toValue: progressPercentage,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage]);

  const handlePress = () => {
    if (onPress) {
      // Scale animation on press
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onPress();
      });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toUpperCase()) {
      case "PRACTICE":
        return colors.primary;
      case "IMPROVEMENT":
        return colors.success;
      case "STREAK":
        return colors.warning;
      case "SOCIAL":
        return colors.info;
      case "MILESTONE":
        return colors.secondary;
      default:
        return colors.textMuted;
    }
  };

  const categoryColor = getCategoryColor(achievement.category);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.card, !isUnlocked && styles.lockedCard]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Category Badge */}
        <View
          style={[styles.categoryBadge, { backgroundColor: categoryColor }]}
        >
          <Text style={styles.categoryText}>
            {achievement.category.charAt(0) +
              achievement.category.slice(1).toLowerCase()}
          </Text>
        </View>

        <View style={styles.content}>
          {/* Icon Section */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconBackground,
                { borderColor: categoryColor },
                isUnlocked && styles.unlockedIconBackground,
              ]}
            >
              <Text style={styles.iconText}>{achievement.icon}</Text>
              {!isUnlocked && (
                <View style={styles.lockOverlay}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={colors.textMutedStrong}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoContainer}>
            <Text
              style={[styles.achievementName, !isUnlocked && styles.lockedText]}
            >
              {achievement.name}
            </Text>
            <Text
              style={styles.achievementDescription}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {achievement.description}
            </Text>

            {/* Progress Bar */}
            {!isUnlocked && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                        backgroundColor: categoryColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {progress}/{achievement.requirement.value} (
                  {Math.round(progressPercentage)}%)
                </Text>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.pointsBadge}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.pointsText}>{achievement.points} pts</Text>
              </View>

              {achievement.isPremium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="diamond" size={10} color={colors.primaryOn} />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              )}

              {isUnlocked && (
                <View style={styles.unlockedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.unlockedText}>Unlocked</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  lockedCard: {
    opacity: 0.8,
  },
  categoryBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primaryOn,
    textTransform: "uppercase",
  },
  content: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 24,
  },
  iconContainer: {
    marginRight: 16,
  },
  iconBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    position: "relative",
  },
  unlockedIconBackground: {
    backgroundColor: colors.successSoft,
  },
  iconText: {
    fontSize: 32,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    opacity: 0.85,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    flex: 1,
  },
  achievementName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  lockedText: {
    color: colors.textMutedStrong,
  },
  achievementDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borderMuted,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warning,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.badgePremiumBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.badgePremiumBorder,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.badgePremiumText,
  },
  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
});
