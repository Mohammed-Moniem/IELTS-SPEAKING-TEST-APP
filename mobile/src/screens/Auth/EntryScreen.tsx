import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { AuthStackParamList } from "../../navigation/AppNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "Entry">;

export const EntryScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { startGuestSession, continueWithGoogle } = useAuth();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGuest = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await startGuestSession();
    } catch (error: any) {
      Alert.alert(
        "Unable to start",
        error?.message || "Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [loading, startGuestSession]);

  const handleGoogle = useCallback(async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      await continueWithGoogle();
    } catch (error: any) {
      Alert.alert(
        "Unable to continue",
        error?.message || "Please try again."
      );
    } finally {
      setGoogleLoading(false);
    }
  }, [continueWithGoogle, googleLoading]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Spokio</Text>
        <Text style={styles.subtitle}>
          Practice IELTS speaking with AI-powered feedback, band scores, and
          progress tracking.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.card, styles.primaryCard, loading && styles.cardDisabled]}
        activeOpacity={0.85}
        onPress={handleGuest}
        disabled={loading}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="flash" size={24} color={colors.primaryOn} />
        </View>
        <Text style={[styles.cardTitle, styles.primaryText]}>
          Continue as guest
        </Text>
        <Text style={[styles.cardDescription, styles.primaryText]}>
          Start practicing right away. You can create an account later to sync
          progress across devices.
        </Text>
        <View style={styles.cardActionRow}>
          {loading ? (
            <ActivityIndicator color={colors.primaryOn} />
          ) : (
            <>
              <Text style={styles.cardActionText}>Start practicing</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.primaryOn}
              />
            </>
          )}
        </View>
      </TouchableOpacity>

      <View style={[styles.card, styles.secondaryCard]}>
        <View style={styles.cardIcon}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Sign in or create an account</Text>
        <Text style={styles.cardDescription}>
          Save your history, unlock social features, and access analytics.
        </Text>

        <Button
          title="Continue with Google"
          variant="ghost"
          onPress={handleGoogle}
          loading={googleLoading}
        />

        <View style={styles.authButtonsRow}>
          <TouchableOpacity
            style={[styles.authButton, styles.primaryButton]}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.secondaryButton]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    primaryCard: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    secondaryCard: {
      backgroundColor: colors.surface,
    },
    cardDisabled: {
      opacity: 0.7,
    },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: `${colors.primaryOn}25`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    cardDescription: {
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    primaryText: {
      color: colors.primaryOn,
    },
    cardActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    cardActionText: {
      color: colors.primaryOn,
      fontWeight: "700",
    },
    authButtonsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    authButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.primaryOn,
      fontWeight: "700",
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
  });
