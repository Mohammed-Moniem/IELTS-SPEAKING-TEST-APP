import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface UsageLimitModalProps {
  visible: boolean;
  sessionType: "practice" | "simulation";
  currentTier: string;
  used: number;
  limit: number;
  resetDate: Date;
  onClose: () => void;
  onUpgrade: () => void;
}

export const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
  visible,
  sessionType,
  currentTier,
  used,
  limit,
  resetDate,
  onClose,
  onUpgrade,
}) => {
  const formatResetDate = (date: Date): string => {
    const d = new Date(date);
    const month = d.toLocaleString("default", { month: "long" });
    const day = d.getDate();
    return `${month} ${day}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={40} color="#ef4444" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Usage Limit Reached</Text>

          {/* Message */}
          <Text style={styles.message}>
            You've used all {limit} {sessionType} session{limit > 1 ? "s" : ""}{" "}
            in your {currentTier} plan this month.
          </Text>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(used / limit) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {used} / {limit} sessions used
            </Text>
          </View>

          {/* Reset Info */}
          <View style={styles.resetInfo}>
            <Ionicons name="refresh" size={20} color="#94a3b8" />
            <Text style={styles.resetText}>
              Resets on {formatResetDate(resetDate)}
            </Text>
          </View>

          {/* Upgrade CTA */}
          <View style={styles.upgradeBox}>
            <Ionicons name="star" size={24} color="#d4a745" />
            <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
            <Text style={styles.upgradeSubtitle}>
              Get unlimited {sessionType} sessions and more
            </Text>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
            <Ionicons name="arrow-up-circle" size={20} color="#fff" />
            <Text style={styles.upgradeButtonText}>View Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#1e293b",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  progressContainer: {
    width: "100%",
    marginBottom: 20,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(100, 116, 139, 0.3)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ef4444",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  resetInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 24,
  },
  resetText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  upgradeBox: {
    backgroundColor: "rgba(212, 167, 69, 0.1)",
    padding: 20,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(212, 167, 69, 0.3)",
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#d4a745",
    marginTop: 8,
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#d4a745",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    justifyContent: "center",
    marginBottom: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 14,
    color: "#94a3b8",
  },
});
