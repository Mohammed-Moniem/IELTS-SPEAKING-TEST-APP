/**
 * PointsCelebrationModal Component
 * Shows a celebratory animation when user earns points
 * Displays: confetti, points earned, reason, and new balance
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
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
import { spacing } from "../theme/tokens";

const { width, height } = Dimensions.get("window");

interface PointsCelebrationModalProps {
  visible: boolean;
  pointsEarned: number;
  reason: string;
  newBalance: number;
  onClose: () => void;
}

export const PointsCelebrationModal: React.FC<PointsCelebrationModalProps> = ({
  visible,
  pointsEarned,
  reason,
  newBalance,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confettiPalette = React.useMemo(
    () => [
      colors.warning,
      colors.primary,
      colors.secondary,
      colors.info,
      colors.success,
      colors.danger,
    ],
    [colors]
  );
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const confettiAnims = React.useRef(
    Array.from({ length: 15 }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Animate modal scale in
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Animate confetti
      confettiAnims.forEach((anim, index) => {
        const randomX = (Math.random() - 0.5) * width;
        const randomDelay = Math.random() * 300;

        Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: height,
            duration: 2000 + Math.random() * 1000,
            delay: randomDelay,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: randomX,
            duration: 2000 + Math.random() * 1000,
            delay: randomDelay,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: Math.random() * 720 - 360,
            duration: 2000,
            delay: randomDelay,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 2000,
            delay: randomDelay + 500,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      // Reset animations
      scaleAnim.setValue(0);
      confettiAnims.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.opacity.setValue(1);
      });
    }
  }, [visible, scaleAnim, confettiAnims]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Confetti */}
        {confettiAnims.map((anim, index) => {
          const color = confettiPalette[index % confettiPalette.length];

          return (
            <Animated.View
              key={index}
              style={[
                styles.confetti,
                {
                  backgroundColor: color,
                  left: width / 2 - 5,
                  top: height / 4,
                  transform: [
                    { translateY: anim.translateY },
                    { translateX: anim.translateX },
                    {
                      rotate: anim.rotate.interpolate({
                        inputRange: [0, 360],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                  opacity: anim.opacity,
                },
              ]}
            />
          );
        })}

        {/* Modal Content */}
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.content,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Star Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="star" size={64} color={colors.warning} />
            </View>

            {/* Points Earned */}
            <Text style={styles.pointsEarned}>+{pointsEarned} Points</Text>

            {/* Reason */}
            <Text style={styles.reason}>{reason}</Text>

            {/* New Balance */}
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>New Balance</Text>
              <Text style={styles.balanceValue}>
                {newBalance.toLocaleString()} pts
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Awesome!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayBackdrop,
    },
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    content: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.xxl,
      alignItems: "center",
      maxWidth: 320,
      width: "100%",
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    confetti: {
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.warningSoft,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    pointsEarned: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    reason: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.xl,
    },
    balanceContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.backgroundMuted,
      borderRadius: 12,
      marginBottom: spacing.xl,
    },
    balanceLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    balanceValue: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.primary,
    },
    closeButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      borderRadius: 24,
      width: "100%",
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primaryOn,
      textAlign: "center",
    },
  });
