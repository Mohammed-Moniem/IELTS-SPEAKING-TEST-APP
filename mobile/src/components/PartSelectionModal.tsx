import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, spacing } from "../theme/tokens";

interface PartSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPart: (part: 1 | 2 | 3) => void;
}

export const PartSelectionModal: React.FC<PartSelectionModalProps> = ({
  visible,
  onClose,
  onSelectPart,
}) => {
  const parts = [
    {
      part: 1 as const,
      title: "Part 1: Introduction & Interview",
      duration: "4-5 minutes",
      description:
        "General questions about yourself, your home, family, work, studies, and interests.",
      icon: "person-outline" as const,
      color: "#3b82f6",
      features: [
        "Familiar topics",
        "Simple, direct questions",
        "Opportunity to warm up",
      ],
    },
    {
      part: 2 as const,
      title: "Part 2: Individual Long Turn",
      duration: "3-4 minutes (1 min prep + 2 min speaking)",
      description:
        "Speak for 2 minutes about a topic given on a task card, after 1 minute of preparation.",
      icon: "document-text-outline" as const,
      color: "#f59e0b",
      features: [
        "Cue card with prompts",
        "1 minute preparation time",
        "2 minutes continuous speaking",
      ],
    },
    {
      part: 3 as const,
      title: "Part 3: Two-way Discussion",
      duration: "4-5 minutes",
      description:
        "Discuss more abstract ideas and issues related to the Part 2 topic.",
      icon: "people-outline" as const,
      color: "#10b981",
      features: [
        "Abstract and analytical",
        "Complex questions",
        "Express and justify opinions",
      ],
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Part</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.subtitle}>
            Choose which part of the IELTS Speaking test you'd like to practice
          </Text>

          {parts.map((item) => (
            <TouchableOpacity
              key={item.part}
              style={[styles.partCard, { borderLeftColor: item.color }]}
              onPress={() => {
                onSelectPart(item.part);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.partHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: item.color },
                  ]}
                >
                  <Ionicons name={item.icon} size={32} color="#ffffff" />
                </View>
                <View style={styles.partTitleContainer}>
                  <Text style={styles.partTitle}>{item.title}</Text>
                  <Text style={styles.duration}>{item.duration}</Text>
                </View>
              </View>

              <Text style={styles.description}>{item.description}</Text>

              <View style={styles.featuresContainer}>
                {item.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={item.color}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.selectButton}>
                <Text style={[styles.selectButtonText, { color: item.color }]}>
                  Practice Part {item.part}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={item.color} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  partCard: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  partHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  partTitleContainer: {
    flex: 1,
  },
  partTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  description: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  featuresContainer: {
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: spacing.xs,
  },
});
