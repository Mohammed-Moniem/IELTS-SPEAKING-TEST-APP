import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  Linking,
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
import { partnerService } from "../../services/api";
import { spacing } from "../../theme/tokens";

export const SettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [partnerLoading, setPartnerLoading] = useState(false);

  const openPartnerPortal = async () => {
    setPartnerLoading(true);
    try {
      const portal = await partnerService.getMe();

      if (!portal.enabled) {
        Alert.alert(
          "Partner Program",
          "The partner program is currently disabled. Please try again later."
        );
        return;
      }

      const destination = portal.isPartner
        ? portal.dashboardUrl || portal.registrationUrl
        : portal.registrationUrl;

      if (!destination) {
        Alert.alert(
          "Partner Program",
          "No partner portal link is available right now."
        );
        return;
      }

      const supported = await Linking.canOpenURL(destination);
      if (supported) {
        await Linking.openURL(destination);
      } else {
        Alert.alert("Partner Program", destination);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to open the partner portal right now.";
      Alert.alert("Partner Program", message);
    } finally {
      setPartnerLoading(false);
    }
  };

  const quickActions = [
    {
      icon: "shield-checkmark" as const,
      title: "Privacy & Account",
      description: "Control your data, profile details, and account settings",
      onPress: () =>
        navigation.navigate("Profile" satisfies keyof AppRootStackParamList),
    },
    {
      icon: "card" as const,
      title: "Subscription",
      description: "See plan details, limits, and upgrade options",
      onPress: () =>
        navigation.navigate("Subscription" satisfies keyof AppRootStackParamList),
    },
    {
      icon: "bar-chart" as const,
      title: "Usage",
      description: "Understand practice and test limits for your current plan",
      onPress: () =>
        navigation.navigate("Usage" satisfies keyof AppRootStackParamList),
    },
    {
      icon: "gift" as const,
      title: "Points & Rewards",
      description: "Review points activity and redeem discount coupons",
      onPress: () =>
        navigation.navigate("PointsDetail" satisfies keyof AppRootStackParamList),
    },
    {
      icon: "megaphone" as const,
      title: "Partner Program",
      description: partnerLoading
        ? "Opening your portal..."
        : "Apply or manage influencer/institute codes and earnings",
      onPress: openPartnerPortal,
    },
  ];

  const roadmapItems = [
    {
      icon: "notifications-outline" as const,
      title: "Notification Preferences",
      description: "Granular reminders, social alerts, and quiet hours.",
    },
    {
      icon: "language-outline" as const,
      title: "Language Support",
      description: "Localized UI and region-specific exam guidance.",
    },
    {
      icon: "volume-high-outline" as const,
      title: "Audio Preferences",
      description: "Voice speed, pronunciation profiles, and playback tuning.",
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
              accessibilityRole="button"
              accessibilityLabel="Replay onboarding"
              accessibilityHint="Shows the onboarding introduction slides again"
            >
              <Text style={[styles.replayButtonText, { color: colors.primaryOn }]}>
                Replay
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* App Settings Section */}
        <SectionHeading title="Quick Access">
          Open the most-used account and control surfaces.
        </SectionHeading>
        <Card style={{ backgroundColor: colors.surface }}>
          {quickActions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionCard,
                index > 0 && styles.optionCardWithBorder,
                { borderTopColor: colors.divider },
              ]}
              onPress={option.onPress}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              accessibilityHint={option.description}
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
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>

        <SectionHeading title="Roadmap">
          These settings are planned and not yet exposed as controls.
        </SectionHeading>
        <Card style={{ backgroundColor: colors.surface }}>
          {roadmapItems.map((item, index) => (
            <View
              key={item.title}
              style={[
                styles.optionCard,
                index > 0 && styles.optionCardWithBorder,
                { borderTopColor: colors.divider },
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: `${colors.info}15` },
                ]}
              >
                <Ionicons name={item.icon} size={22} color={colors.info} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                  {item.description}
                </Text>
              </View>
            </View>
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
});
