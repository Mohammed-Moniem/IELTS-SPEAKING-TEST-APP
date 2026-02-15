import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { radii, spacing } from "../theme/tokens";
import { Card } from "./Card";

export type NextBestAction = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
};

export const NextBestActionsCard: React.FC<{
  title?: string;
  actions: NextBestAction[];
}> = ({ title = "Next best actions", actions }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const visible = actions.filter((a) => !a.disabled);
  if (visible.length === 0) {
    return null;
  }

  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {visible.map((action, idx) => {
          const isLast = idx === visible.length - 1;
          return (
            <TouchableOpacity
              key={action.id}
              accessibilityRole="button"
              onPress={action.onPress}
              disabled={action.disabled}
              style={[styles.row, isLast ? styles.rowLast : null]}
              activeOpacity={0.85}
            >
              <View style={styles.rowLeft}>
                {action.icon ? (
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={action.icon as any}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                ) : null}
                <View style={styles.texts}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  {action.subtitle ? (
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  ) : null}
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    title: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    list: {
      borderRadius: radii.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
    },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    actionTitle: {
      fontWeight: "800",
      color: colors.textPrimary,
    },
    actionSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
  });

