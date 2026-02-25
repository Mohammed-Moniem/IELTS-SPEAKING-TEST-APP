import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";

interface AchievementUnlockedModalProps {
  visible: boolean;
  achievement: {
    icon: string;
    name: string;
    description: string;
    points: number;
  } | null;
  onClose: () => void;
}

const { width } = Dimensions.get("window");

export const AchievementUnlockedModal: React.FC<
  AchievementUnlockedModalProps
> = ({ visible, achievement, onClose }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const starRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      bounceAnim.setValue(0);
      starRotate.setValue(0);

      // Start animations sequence
      Animated.sequence([
        // Fade in background
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Scale up badge
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        // Bounce effect
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Continuous star rotation
      Animated.loop(
        Animated.timing(starRotate, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [visible]);

  if (!achievement) return null;

  const starRotateInterpolate = starRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ scale: scaleAnim }, { translateY: bounceAnim }],
            },
          ]}
        >
          {/* Decorative stars */}
          <Animated.View
            style={[
              styles.decorativeStar,
              styles.starTopLeft,
              { transform: [{ rotate: starRotateInterpolate }] },
            ]}
          >
            <Ionicons name="star" size={20} color={colors.warning} />
          </Animated.View>
          <Animated.View
            style={[
              styles.decorativeStar,
              styles.starTopRight,
              { transform: [{ rotate: starRotateInterpolate }] },
            ]}
          >
            <Ionicons name="star" size={16} color={colors.warning} />
          </Animated.View>
          <Animated.View
            style={[
              styles.decorativeStar,
              styles.starBottomLeft,
              { transform: [{ rotate: starRotateInterpolate }] },
            ]}
          >
            <Ionicons name="star" size={14} color={colors.warning} />
          </Animated.View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🎉 Achievement Unlocked!</Text>
          </View>

          {/* Badge Icon */}
          <View style={styles.badgeContainer}>
            <View style={styles.badgeBackground}>
              <Text style={styles.badgeIcon}>{achievement.icon}</Text>
            </View>
          </View>

          {/* Achievement Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.achievementName}>{achievement.name}</Text>
            <Text style={styles.achievementDescription}>
              {achievement.description}
            </Text>

            {/* Points Badge */}
            <View style={styles.pointsBadge}>
              <Ionicons name="star" size={18} color={colors.warning} />
              <Text style={styles.pointsText}>
                +{achievement.points} points
              </Text>
            </View>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayBackdrop,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  decorativeStar: {
    position: "absolute",
  },
  starTopLeft: {
    top: 20,
    left: 20,
  },
  starTopRight: {
    top: 30,
    right: 30,
  },
  starBottomLeft: {
    bottom: 40,
    left: 30,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "center",
  },
  badgeContainer: {
    marginVertical: 20,
  },
  badgeBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  badgeIcon: {
    fontSize: 60,
  },
  infoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  achievementName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  achievementDescription: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.warning,
  },
  closeButton: {
    width: "100%",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.primaryOn,
  },
});
