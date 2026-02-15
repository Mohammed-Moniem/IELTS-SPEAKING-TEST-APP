import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
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

interface UsageLimitModalProps {
  visible: boolean;
  sessionType: "practice" | "simulation";
  currentTier: string;
  used: number;
  limit: number;
  resetDate?: Date;
  onClose: () => void;
  onUpgrade: () => void;
  upgradeEnabled?: boolean;
}

const sessionLabelMap: Record<"practice" | "simulation", string> = {
  practice: "practice",
  simulation: "simulation",
};

export const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
  visible,
  sessionType,
  currentTier,
  used,
  limit,
  resetDate,
  onClose,
  onUpgrade,
  upgradeEnabled = true,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const safeLimit = Math.max(limit, 1);
  const progressWidth = Math.min(100, Math.round((used / safeLimit) * 100));

  const resetCopy = resetDate
    ? `Resets on ${resetDate.toLocaleDateString()}`
    : "Usage resets every billing cycle";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="lock-closed" size={40} color={colors.danger} />
            </View>
          </View>

          <Text style={styles.title}>Usage limit reached</Text>
          <Text style={styles.message}>
            You've used all {limit} {sessionLabelMap[sessionType]} session
            {limit > 1 ? "s" : ""} in your {currentTier} plan this month.
          </Text>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressWidth}%`,
                    backgroundColor: colors.danger,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {used} / {limit} sessions used
            </Text>
          </View>

          <View style={[styles.resetInfo, { backgroundColor: colors.backgroundMuted }]}>
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            <Text style={styles.resetText}>{resetCopy}</Text>
          </View>

          {upgradeEnabled ? (
            <>
              <View
                style={[
                  styles.upgradeBox,
                  {
                    backgroundColor: colors.surfaceSubtle ?? colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="star" size={22} color={colors.warning} />
                <Text style={styles.upgradeTitle}>Upgrade for more sessions</Text>
                <Text style={styles.upgradeSubtitle}>
                  Unlock unlimited {sessionLabelMap[sessionType]} sessions, advanced
                  analytics, and priority support.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
                onPress={onUpgrade}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={20}
                  color={colors.primaryOn}
                />
                <Text
                  style={[styles.upgradeButtonText, { color: colors.primaryOn }]}
                >
                  View plans
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.xxl,
      width: "100%",
      maxWidth: 420,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconContainer: {
      marginBottom: spacing.lg,
    },
    iconCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    progressContainer: {
      width: "100%",
      marginBottom: spacing.lg,
    },
    progressBar: {
      width: "100%",
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: spacing.xs,
    },
    progressFill: {
      height: "100%",
      borderRadius: 4,
    },
    progressText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    resetInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: spacing.lg,
      marginBottom: spacing.lg,
    },
    resetText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    upgradeBox: {
      width: "100%",
      borderRadius: 18,
      padding: spacing.lg,
      alignItems: "center",
      marginBottom: spacing.lg,
      borderWidth: 1,
    },
    upgradeTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    upgradeSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
    },
    upgradeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: spacing.lg,
      width: "100%",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: "600",
    },
    closeButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    closeButtonText: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
  });
