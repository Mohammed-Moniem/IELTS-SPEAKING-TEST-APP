import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../components/Button";
import { ScreenContainer } from "../components/ScreenContainer";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

interface GuestLockedScreenProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta: () => void;
}

export const GuestLockedScreen: React.FC<GuestLockedScreenProps> = ({
  title,
  description,
  ctaLabel = "Create account",
  onCta,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="lock-closed" size={36} color={colors.danger} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.actions}>
          <Button title={ctaLabel} onPress={onCta} />
        </View>
      </View>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    iconCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    actions: {
      width: "100%",
      maxWidth: 420,
    },
  });

