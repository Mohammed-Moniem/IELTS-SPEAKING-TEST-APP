/**
 * Notification Settings Screen
 * Allows users to configure their notification preferences
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import notificationService from "../../services/notificationService";
import { colors, spacing } from "../../theme/tokens";

interface NotificationSettings {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number;
  dailyReminderMinute: number;
  achievementsEnabled: boolean;
  streakRemindersEnabled: boolean;
  inactivityRemindersEnabled: boolean;
  feedbackNotificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  dailyReminderEnabled: true,
  dailyReminderHour: 19, // 7 PM
  dailyReminderMinute: 0,
  achievementsEnabled: true,
  streakRemindersEnabled: true,
  inactivityRemindersEnabled: true,
  feedbackNotificationsEnabled: true,
};

const STORAGE_KEY = "notification_settings";

export const NotificationSettingsScreen: React.FC = () => {
  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [permissionStatus, setPermissionStatus] =
    useState<string>("checking...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    checkPermissionStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      Alert.alert("Error", "Failed to save settings");
    }
  };

  const checkPermissionStatus = async () => {
    const status = await notificationService.getPermissionStatus();
    setPermissionStatus(status);
  };

  const requestPermission = async () => {
    const granted = await notificationService.requestPermissions();
    if (granted) {
      setPermissionStatus("granted");
      await notificationService.initialize();
      Alert.alert(
        "Success",
        "Notifications enabled! You can now customize your reminders."
      );
    } else {
      Alert.alert(
        "Permission Denied",
        "Please enable notifications in your device settings to receive reminders."
      );
    }
  };

  const toggleDailyReminder = async (enabled: boolean) => {
    const newSettings = { ...settings, dailyReminderEnabled: enabled };
    await saveSettings(newSettings);

    if (permissionStatus === "granted") {
      await notificationService.scheduleDailyReminder(
        settings.dailyReminderHour,
        settings.dailyReminderMinute,
        enabled
      );
    }
  };

  const changeDailyReminderTime = () => {
    // For now, use simple hour selection
    // In production, you might want to use a proper time picker
    Alert.alert("Set Reminder Time", "Choose your preferred reminder time:", [
      {
        text: "9:00 AM",
        onPress: () => updateReminderTime(9, 0),
      },
      {
        text: "1:00 PM",
        onPress: () => updateReminderTime(13, 0),
      },
      {
        text: "7:00 PM",
        onPress: () => updateReminderTime(19, 0),
      },
      {
        text: "9:00 PM",
        onPress: () => updateReminderTime(21, 0),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const updateReminderTime = async (hour: number, minute: number) => {
    const newSettings = {
      ...settings,
      dailyReminderHour: hour,
      dailyReminderMinute: minute,
    };
    await saveSettings(newSettings);

    if (permissionStatus === "granted" && settings.dailyReminderEnabled) {
      await notificationService.scheduleDailyReminder(hour, minute, true);
      Alert.alert(
        "Updated",
        `Daily reminder set for ${formatTime(hour, minute)}`
      );
    }
  };

  const toggleSetting = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const displayMinute = minute.toString().padStart(2, "0");
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const testNotification = async () => {
    await notificationService.scheduleNotification(
      "Test Notification",
      "This is a test notification from IELTS Speaking Test",
      { type: "timeInterval" as any, seconds: 2, repeats: false },
      { test: true }
    );
    Alert.alert("Test Sent", "You should receive a notification in 2 seconds");
  };

  if (isLoading) {
    return (
      <ScreenContainer scrollable>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </ScreenContainer>
    );
  }

  if (permissionStatus !== "granted") {
    return (
      <ScreenContainer scrollable>
        <SectionHeading title="Enable Notifications">
          Stay on track with personalized reminders and updates
        </SectionHeading>

        <Card>
          <Text style={styles.permissionTitle}>
            📬 Notifications are disabled
          </Text>
          <Text style={styles.permissionDescription}>
            Enable notifications to receive:
          </Text>
          <View style={styles.benefitsList}>
            <Text style={styles.benefit}>• Daily practice reminders</Text>
            <Text style={styles.benefit}>• Achievement celebrations</Text>
            <Text style={styles.benefit}>• Streak tracking alerts</Text>
            <Text style={styles.benefit}>• Feedback ready notifications</Text>
          </View>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={requestPermission}
          >
            <Text style={styles.enableButtonText}>Enable Notifications</Text>
          </TouchableOpacity>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable>
      <SectionHeading title="Notification Settings">
        Customize your reminder preferences
      </SectionHeading>

      {/* Daily Reminder */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Daily Practice Reminder</Text>
            <Text style={styles.settingDescription}>
              Get a daily nudge to practice
            </Text>
          </View>
          <Switch
            value={settings.dailyReminderEnabled}
            onValueChange={toggleDailyReminder}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>

        {settings.dailyReminderEnabled && (
          <TouchableOpacity
            style={styles.timeSelector}
            onPress={changeDailyReminderTime}
          >
            <Text style={styles.timeSelectorLabel}>Reminder time</Text>
            <Text style={styles.timeSelectorValue}>
              {formatTime(
                settings.dailyReminderHour,
                settings.dailyReminderMinute
              )}
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Achievement Notifications */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Achievement Notifications</Text>
            <Text style={styles.settingDescription}>
              Get notified when you unlock achievements
            </Text>
          </View>
          <Switch
            value={settings.achievementsEnabled}
            onValueChange={(val) => toggleSetting("achievementsEnabled", val)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>
      </Card>

      {/* Streak Reminders */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Streak Reminders</Text>
            <Text style={styles.settingDescription}>
              Alerts when your practice streak is at risk
            </Text>
          </View>
          <Switch
            value={settings.streakRemindersEnabled}
            onValueChange={(val) =>
              toggleSetting("streakRemindersEnabled", val)
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>
      </Card>

      {/* Inactivity Reminders */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Inactivity Reminders</Text>
            <Text style={styles.settingDescription}>
              Get a gentle reminder if you haven't practiced in a while
            </Text>
          </View>
          <Switch
            value={settings.inactivityRemindersEnabled}
            onValueChange={(val) =>
              toggleSetting("inactivityRemindersEnabled", val)
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>
      </Card>

      {/* Feedback Notifications */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Feedback Ready</Text>
            <Text style={styles.settingDescription}>
              Know when your AI feedback is ready to review
            </Text>
          </View>
          <Switch
            value={settings.feedbackNotificationsEnabled}
            onValueChange={(val) =>
              toggleSetting("feedbackNotificationsEnabled", val)
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>
      </Card>

      {/* Test Notification */}
      <Card>
        <TouchableOpacity style={styles.testButton} onPress={testNotification}>
          <Text style={styles.testButtonText}>🔔 Send Test Notification</Text>
        </TouchableOpacity>
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  loadingText: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  permissionDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  benefitsList: {
    marginBottom: spacing.lg,
  },
  benefit: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  enableButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },
  enableButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textMuted,
  },
  timeSelector: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeSelectorLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  timeSelectorValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  testButton: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
