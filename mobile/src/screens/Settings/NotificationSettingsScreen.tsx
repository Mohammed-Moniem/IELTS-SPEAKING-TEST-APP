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

import { notificationsApi } from "../../api/services";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../../constants/notifications";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import notificationService from "../../services/notificationService";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { NotificationSettings } from "../../types/api";
import { extractErrorMessage } from "../../utils/errors";
import { logger } from "../../utils/logger";

const STORAGE_KEY = "notification_settings";

export const NotificationSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [permissionStatus, setPermissionStatus] =
    useState<string>("checking...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadSettings();
    void checkPermissionStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const remote = await notificationsApi.getPreferences();
      setSettings(remote);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
    } catch (error) {
      console.warn("Failed to fetch notification settings:", error);
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setSettings(JSON.parse(stored));
        } else {
          setSettings(DEFAULT_NOTIFICATION_SETTINGS);
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS)
          );
        }
      } catch (storageError) {
        logger.warn("Unable to read cached notification settings", storageError);
        setSettings(DEFAULT_NOTIFICATION_SETTINGS);
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS)
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const persistSettings = async (
    nextSettings: NotificationSettings,
    options?: { skipRemote?: boolean }
  ) => {
    const previous = settings;
    setSettings(nextSettings);

    try {
      if (options?.skipRemote) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
        return nextSettings;
      }

      setIsSaving(true);
      const updated = await notificationsApi.updatePreferences(nextSettings);
      setSettings(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (error) {
      logger.warn("Failed to save notification settings:", error);
      setSettings(previous);
      Alert.alert("Error", extractErrorMessage(error));
      throw error;
    } finally {
      if (!options?.skipRemote) {
        setIsSaving(false);
      }
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
    const updated = await persistSettings({
      ...settings,
      dailyReminderEnabled: enabled,
    });

    if (permissionStatus === "granted") {
      await notificationService.scheduleDailyReminder(
        updated.dailyReminderHour,
        updated.dailyReminderMinute,
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
    const updated = await persistSettings({
      ...settings,
      dailyReminderHour: hour,
      dailyReminderMinute: minute,
    });

    if (permissionStatus === "granted" && updated.dailyReminderEnabled) {
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
    await persistSettings(newSettings);
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
      {isSaving && (
        <Text style={styles.savingText}>Saving your preferences...</Text>
      )}

      <SectionHeading title="Practice Reminders">
        Keep your study rhythm on track
      </SectionHeading>
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
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
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

      <SectionHeading title="Progress & Feedback">
        Celebrate wins and track feedback
      </SectionHeading>
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
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

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
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Inactivity Reminders</Text>
            <Text style={styles.settingDescription}>
              Gentle reminders when you miss a day of practice
            </Text>
          </View>
          <Switch
            value={settings.inactivityRemindersEnabled}
            onValueChange={(val) =>
              toggleSetting("inactivityRemindersEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Feedback Ready</Text>
            <Text style={styles.settingDescription}>
              Know instantly when AI feedback is available
            </Text>
          </View>
          <Switch
            value={settings.feedbackNotificationsEnabled}
            onValueChange={(val) =>
              toggleSetting("feedbackNotificationsEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <SectionHeading title="Chat Notifications">
        Stay in sync with friends and study groups
      </SectionHeading>
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Direct Messages</Text>
            <Text style={styles.settingDescription}>
              Alerts when friends send you private messages
            </Text>
          </View>
          <Switch
            value={settings.directMessagesEnabled}
            onValueChange={(val) =>
              toggleSetting("directMessagesEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Group Chats</Text>
            <Text style={styles.settingDescription}>
              Notifications for group discussion updates
            </Text>
          </View>
          <Switch
            value={settings.groupMessagesEnabled}
            onValueChange={(val) =>
              toggleSetting("groupMessagesEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Friend Requests</Text>
            <Text style={styles.settingDescription}>
              Alerts when someone sends you a friend request
            </Text>
          </View>
          <Switch
            testID="toggle-friend-requests"
            value={settings.friendRequestsEnabled}
            onValueChange={(val) =>
              toggleSetting("friendRequestsEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Friend Acceptances</Text>
            <Text style={styles.settingDescription}>
              Alerts when your friend request is accepted
            </Text>
          </View>
          <Switch
            testID="toggle-friend-acceptances"
            value={settings.friendAcceptancesEnabled}
            onValueChange={(val) =>
              toggleSetting("friendAcceptancesEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <SectionHeading title="Announcements & Offers">
        Hear about product updates and rewards
      </SectionHeading>
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>System Announcements</Text>
            <Text style={styles.settingDescription}>
              Product updates, new features, and important notices
            </Text>
          </View>
          <Switch
            value={settings.systemAnnouncementsEnabled}
            onValueChange={(val) =>
              toggleSetting("systemAnnouncementsEnabled", val)
            }
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Special Offers</Text>
            <Text style={styles.settingDescription}>
              Discounts, bonus sessions, and referral rewards
            </Text>
          </View>
          <Switch
            value={settings.offersEnabled}
            onValueChange={(val) => toggleSetting("offersEnabled", val)}
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Partner Offers</Text>
            <Text style={styles.settingDescription}>
              Promotions shared through influencers and institutes
            </Text>
          </View>
          <Switch
            testID="toggle-partner-offers"
            value={settings.partnerOffersEnabled}
            onValueChange={(val) => toggleSetting("partnerOffersEnabled", val)}
            disabled={isSaving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.primaryOn}
          />
        </View>
      </Card>

      <Card>
        <TouchableOpacity
          style={styles.testButton}
          onPress={testNotification}
          disabled={isSaving}
        >
          <Text style={styles.testButtonText}>🔔 Send Test Notification</Text>
        </TouchableOpacity>
      </Card>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  loadingText: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  savingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: spacing.md,
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
    color: colors.primaryOn,
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
