import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { useTheme } from "../../context/ThemeContext";
import { ONBOARDING_KEY, type AppStackParamList } from "../../navigation/AppNavigator";
import { spacing } from "../../theme/tokens";

export const SettingsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme, themeMode, colors, setThemeMode } = useTheme();
  const [autoSystem, setAutoSystem] = useState(themeMode === "system");

  const handleThemeToggle = async (value: boolean) => {
    if (autoSystem) {
      Alert.alert(
        "Auto Theme Active",
        "Please disable 'Follow System Theme' first to manually select a theme."
      );
      return;
    }
    await setThemeMode(value ? "dark" : "light");
  };

  const handleAutoSystemToggle = async (value: boolean) => {
    setAutoSystem(value);
    await setThemeMode(value ? "system" : theme);
  };

  const settingsOptions = [
    {
      icon: "notifications" as const,
      title: "Notifications",
      description: "Manage notification preferences",
      onPress: () => {
        navigation.navigate("NotificationSettings");
      },
    },
    {
      icon: "help-circle" as const,
      title: "Help & support",
      description: "Send feedback or report an issue",
      onPress: () => {
        navigation.navigate("HelpSupport");
      },
    },
    {
      icon: "shield-checkmark" as const,
      title: "Data & privacy",
      description: "Export or delete your account",
      onPress: () => {
        navigation.navigate("DataPrivacy");
      },
    },
    {
      icon: "play-circle" as const,
      title: "Replay onboarding",
      description: "View the intro screens again",
      onPress: async () => {
        await AsyncStorage.removeItem(ONBOARDING_KEY);
        navigation.navigate("OnboardingReplay");
      },
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
          {/* Auto System Theme */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingTitle, { color: colors.textPrimary }]}
              >
                Follow System Theme
              </Text>
              <Text
                style={[styles.settingDescription, { color: colors.textMuted }]}
              >
                Automatically match your device settings
              </Text>
            </View>
            <Switch
              value={autoSystem}
              onValueChange={handleAutoSystemToggle}
              trackColor={{ false: colors.borderMuted, true: colors.primary }}
              thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
            />
          </View>

          {/* Manual Dark Mode Toggle */}
          <View
            style={[
              styles.settingRow,
              styles.settingRowWithBorder,
              { borderTopColor: colors.divider },
            ]}
          >
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingTitle, { color: colors.textPrimary }]}
              >
                Dark Mode
              </Text>
              <Text
                style={[styles.settingDescription, { color: colors.textMuted }]}
              >
                {autoSystem
                  ? "Controlled by system settings"
                  : "Toggle dark theme manually"}
              </Text>
            </View>
            <Switch
              value={theme === "dark"}
              onValueChange={handleThemeToggle}
              disabled={autoSystem}
              trackColor={{ false: colors.borderMuted, true: colors.primary }}
              thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
            />
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
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
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
  settingRowWithBorder: {
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.md + spacing.sm,
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
