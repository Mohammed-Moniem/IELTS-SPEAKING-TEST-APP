import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useProfile } from "../../hooks";

export const PrivacySettingsScreen: React.FC = () => {
  const { loadMyProfile, updatePrivacySettings } = useProfile();
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
    loadSettings();
  }, []);

  const loadSettings = async () => {
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
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await updatePrivacySettings({
      profileVisibility: settings.profileVisibility,
      leaderboardOptIn: settings.leaderboardOptIn,
      showStatistics: settings.showStatistics,
      showActivity: settings.showActivity,
    });
    setSaving(false);

    if (success) {
      Alert.alert("Success", "Privacy settings updated");
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
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: "uppercase",
  },
  visibilitySection: {
    backgroundColor: "#FFFFFF",
    marginTop: 24,
  },
  visibilityOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  visibilityInfo: {
    flex: 1,
    marginRight: 16,
  },
  visibilityTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  visibilityDescription: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7C7CC",
  },
  radioSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  optionInfo: {
    flex: 1,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: "#F2F2F7",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
