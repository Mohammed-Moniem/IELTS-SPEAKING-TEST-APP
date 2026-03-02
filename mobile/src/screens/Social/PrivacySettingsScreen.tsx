import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context";
import { useProfile } from "../../hooks";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { logger } from "../../utils/logger";

export const PrivacySettingsScreen: React.FC = () => {
  const { loadMyProfile, updatePrivacySettings } = useProfile();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    profileVisibility: "public" as "public" | "friends-only" | "private",
    leaderboardOptIn: true,
    showStatistics: true,
    showActivity: true,
    showOnlineStatus: true,
  });

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const profile = await loadMyProfile();
      if (profile) {
        setSettings({
          profileVisibility: profile.privacy.profileVisibility,
          leaderboardOptIn: profile.privacy.leaderboardOptIn,
          showStatistics: profile.privacy.showStatistics,
          showActivity: profile.privacy.showActivity,
          showOnlineStatus: profile.social.showOnlineStatus,
        });
      }
    } catch (error) {
      logger.warn("Unable to load privacy settings", error);
      Alert.alert(
        "Unable to load settings",
        "Please try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updatePrivacySettings({
        profileVisibility: settings.profileVisibility,
        leaderboardOptIn: settings.leaderboardOptIn,
        showStatistics: settings.showStatistics,
        showActivity: settings.showActivity,
      });

      if (success) {
        Alert.alert("Saved", "Privacy settings updated.");
      } else {
        Alert.alert(
          "Update failed",
          "We couldn't update your settings. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const privacyOptions = [
    {
      key: "leaderboardOptIn" as keyof typeof settings,
      title: "Show on Leaderboard",
      description: "Display your rank on the global leaderboard",
      isBoolean: true,
    },
    {
      key: "showStatistics" as keyof typeof settings,
      title: "Show Statistics",
      description: "Let others see your practice statistics",
      isBoolean: true,
    },
    {
      key: "showActivity" as keyof typeof settings,
      title: "Show Activity",
      description: "Display your recent activity on your profile",
      isBoolean: true,
    },
    {
      key: "showOnlineStatus" as keyof typeof settings,
      title: "Show Online Status",
      description: "Let friends see when you are online",
      isBoolean: true,
    },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading privacy settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Controls</Text>
          <Text style={styles.sectionDescription}>
            Choose what information you want to share with others
          </Text>
        </View>

        {/* Profile Visibility */}
        <View style={styles.visibilitySection}>
          <Text style={styles.sectionHeader}>PROFILE VISIBILITY</Text>
          {(["public", "friends-only", "private"] as const).map(
            (visibility) => (
              <TouchableOpacity
                key={visibility}
                style={styles.visibilityOption}
                onPress={() =>
                  setSettings((prev) => ({
                    ...prev,
                    profileVisibility: visibility,
                  }))
                }
              >
                <View style={styles.visibilityInfo}>
                  <Text style={styles.visibilityTitle}>
                    {visibility === "public"
                      ? "Public"
                      : visibility === "friends-only"
                      ? "Friends Only"
                      : "Private"}
                  </Text>
                  <Text style={styles.visibilityDescription}>
                    {visibility === "public"
                      ? "Anyone can view your profile"
                      : visibility === "friends-only"
                      ? "Only your friends can view your profile"
                      : "Only you can view your profile"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    settings.profileVisibility === visibility &&
                      styles.radioSelected,
                  ]}
                />
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Other Privacy Options */}
        {privacyOptions.map((option) => (
          <View key={option.key} style={styles.optionCard}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <Switch
              value={settings[option.key] as boolean}
              onValueChange={() => toggleSetting(option.key)}
              trackColor={{
                false: colors.borderMuted,
                true: colors.primarySoft,
              }}
              thumbColor={
                settings[option.key] ? colors.primary : colors.surface
              }
            />
          </View>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Your privacy settings help control what information is visible to
            other users. Changes take effect immediately.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || loading}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundMuted,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    content: {
      paddingBottom: 100,
    },
    section: {
      padding: spacing.xl,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    sectionDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textTransform: "uppercase",
    },
    visibilitySection: {
      backgroundColor: colors.surface,
      marginTop: spacing.xl,
    },
    visibilityOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    visibilityInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    visibilityTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.xxs,
    },
    visibilityDescription: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    radioSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    optionInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    optionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.xxs,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    infoBox: {
      backgroundColor: colors.surfaceSubtle,
      padding: spacing.md,
      margin: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderMuted,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: 12,
      alignItems: "center",
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.primaryOn,
      fontSize: 17,
      fontWeight: "600",
    },
  });
