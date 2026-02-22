import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { ThemeModeSwitch } from "../../components/ThemeModeSwitch";
import { useTheme } from "../../context/ThemeContext";
import { AppRootStackParamList } from "../../navigation/AppNavigator";
import { spacing } from "../../theme/tokens";

export const SettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const settingsOptions = [
    {
      icon: "notifications" as const,
      title: "Notifications",
      description: "Manage notification preferences",
      status: "coming_soon" as const,
    },
    {
      icon: "language" as const,
      title: "Language",
      description: "Change app language",
      status: "coming_soon" as const,
    },
    {
      icon: "volume-high" as const,
      title: "Audio Settings",
      description: "Adjust voice and sound settings",
      status: "coming_soon" as const,
    },
    {
      icon: "shield-checkmark" as const,
      title: "Privacy",
      description: "Control your data and privacy",
      status: "available" as const,
      onPress: () => navigation.navigate("Profile" satisfies keyof AppRootStackParamList),
    },
  ];

  return (
    <ScreenContainer scrollable>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Appearance Section */}
        <SectionHeading title="Appearance">
          Customize how Spokio looks
        </SectionHeading>
        <Card style={{ backgroundColor: colors.surface }}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingTitle, { color: colors.textPrimary }]}
              >
                Theme
              </Text>
              <Text
                style={[styles.settingDescription, { color: colors.textMuted }]}
              >
                Cycle between System, Light, and Dark mode
              </Text>
            </View>
            <ThemeModeSwitch />
          </View>
          <View style={[styles.settingRow, styles.settingRowTopBorder, { borderTopColor: colors.divider }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                Replay Onboarding
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                View the intro slides again any time
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.replayButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate("OnboardingReplay")}
            >
              <Text style={styles.replayButtonText}>Replay</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* App Settings Section */}
        <SectionHeading title="App Settings">
          Configure your experience
        </SectionHeading>
        <Card style={{ backgroundColor: colors.surface }}>
          {settingsOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionCard,
                index > 0 && styles.optionCardWithBorder,
                { borderTopColor: colors.divider },
              ]}
              disabled={option.status !== "available"}
              onPress={option.onPress}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: `${colors.primary}15` },
                ]}
              >
                <Ionicons name={option.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text
                  style={[styles.optionTitle, { color: colors.textPrimary }]}
                >
                  {option.title}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: colors.textMuted },
                  ]}
                >
                  {option.description}
                </Text>
              </View>
              {option.status === "available" ? (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textMuted}
                />
              ) : (
                <View style={[styles.badge, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={[styles.badgeText, { color: colors.textMutedStrong }]}>
                    Coming soon
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </Card>

        {/* About Section */}
        <SectionHeading title="About">App information</SectionHeading>
        <Card style={{ backgroundColor: colors.surface }}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Version
            </Text>
            <Text style={[styles.infoValue, { color: colors.textMuted }]}>
              1.0.0
            </Text>
          </View>
          <View
            style={[
              styles.infoRow,
              styles.infoRowWithBorder,
              { borderTopColor: colors.divider },
            ]}
          >
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Build
            </Text>
            <Text style={[styles.infoValue, { color: colors.textMuted }]}>
              {Platform.OS === "ios" ? "iOS" : "Android"} • {Platform.Version}
            </Text>
          </View>
        </Card>

        {/* Help Section */}
        <SectionHeading title="Help & Support">Get assistance</SectionHeading>
        <Card style={{ backgroundColor: colors.surface }}>
          <TouchableOpacity
            style={styles.optionCard}
            disabled
          >
            <View
              style={[
                styles.optionIcon,
                { backgroundColor: `${colors.info}15` },
              ]}
            >
              <Ionicons name="help-circle" size={22} color={colors.info} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                Help Center
              </Text>
              <Text
                style={[styles.optionDescription, { color: colors.textMuted }]}
              >
                FAQs and tutorials
              </Text>
            </View>
            <Ionicons
              name="time-outline"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              styles.optionCardWithBorder,
              { borderTopColor: colors.divider },
            ]}
            disabled
          >
            <View
              style={[
                styles.optionIcon,
                { backgroundColor: `${colors.info}15` },
              ]}
            >
              <Ionicons name="mail" size={22} color={colors.info} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                Contact Support
              </Text>
              <Text
                style={[styles.optionDescription, { color: colors.textMuted }]}
              >
                Get in touch with us
              </Text>
            </View>
            <Ionicons
              name="time-outline"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </Card>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  settingRowTopBorder: {
    borderTopWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xxs,
  },
  settingDescription: {
    fontSize: 14,
  },
  replayButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  replayButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionCardWithBorder: {
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xxs,
  },
  optionDescription: {
    fontSize: 13,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoRowWithBorder: {
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
