import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { AuthStackParamList } from "../../navigation/AppNavigator";
import { markFreeTrialUsed, hasUsedFreeTrial } from "../../storage/freeTrialStorage";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "TrialEntry">;

export const TrialEntryScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { startGuestSession } = useAuth();

  const [trialUsed, setTrialUsed] = useState<boolean>(false);
  const [checkingState, setCheckingState] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    hasUsedFreeTrial()
      .then((used) => {
        if (mounted) {
          setTrialUsed(used);
        }
      })
      .finally(() => {
        if (mounted) {
          setCheckingState(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleTryNow = useCallback(async () => {
    if (trialUsed || loading) {
      return;
    }
    setLoading(true);
    try {
      await startGuestSession();
      await markFreeTrialUsed();
      setTrialUsed(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to start the free trial session.";
      Alert.alert("Something went wrong", message);
      setTrialUsed(false);
    } finally {
      setLoading(false);
    }
  }, [loading, startGuestSession, trialUsed]);

  const handleAuthNavigate = useCallback(
    (destination: "Login" | "Register") => {
      navigation.navigate(destination);
    },
    [navigation]
  );

  if (checkingState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to IELTS Practice</Text>
        <Text style={styles.subtitle}>
          Try a full test simulation for free or sign in to continue your
          journey.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.card,
          styles.tryCard,
          trialUsed && styles.cardDisabled,
        ]}
        activeOpacity={trialUsed ? 1 : 0.85}
        onPress={handleTryNow}
        disabled={trialUsed || loading}
      >
        <View style={styles.cardIcon}>
          <Ionicons
            name="flash"
            size={24}
            color={trialUsed ? colors.textMuted : colors.primary}
          />
        </View>
        <Text style={[styles.cardTitle, styles.tryCardText]}>Try it now</Text>
        <Text style={[styles.cardDescription, styles.tryCardText]}>
          Jump straight into an AI-powered full IELTS speaking simulation.
        </Text>
        <View style={styles.cardActionRow}>
          {loading ? (
            <ActivityIndicator color={colors.primaryOn} />
          ) : (
            <Text style={styles.cardActionText}>
              {trialUsed ? "Trial used" : "Start full test"}
            </Text>
          )}
          {!trialUsed && !loading && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.primaryOn}
            />
          )}
        </View>
        {trialUsed ? (
          <Text style={styles.trialHint}>
            Your free trial has been used. Create an account to continue.
          </Text>
        ) : (
          <Text style={styles.trialHint}>One complimentary session only</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.authCard]}
        activeOpacity={0.85}
        onPress={() => handleAuthNavigate("Login")}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="person-add" size={24} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Register / Login</Text>
        <Text style={styles.cardDescription}>
          Create an account or sign in to unlock unlimited practice, track your
          progress, and sync across devices.
        </Text>
        <View style={styles.authButtonsRow}>
          <TouchableOpacity
            style={[styles.authButton, styles.primaryButton]}
            onPress={() => handleAuthNavigate("Register")}
          >
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.secondaryButton]}
            onPress={() => handleAuthNavigate("Login")}
          >
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.xl,
      backgroundColor: colors.background,
      justifyContent: "center",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    header: {
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: spacing.sm,
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 22,
    },
    card: {
      borderRadius: 24,
      padding: spacing.xl,
      backgroundColor: colors.surface,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tryCard: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    authCard: {
      backgroundColor: colors.surface,
    },
    cardDisabled: {
      opacity: 0.6,
    },
    cardIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.backgroundMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    cardDescription: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    tryCardText: {
      color: colors.primaryOn,
    },
    cardActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardActionText: {
      color: colors.primaryOn,
      fontWeight: "600",
      fontSize: 16,
    },
    trialHint: {
      marginTop: spacing.md,
      color: colors.primaryOn,
      opacity: 0.8,
    },
    authButtonsRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    authButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.primaryOn,
      fontWeight: "600",
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
  });
