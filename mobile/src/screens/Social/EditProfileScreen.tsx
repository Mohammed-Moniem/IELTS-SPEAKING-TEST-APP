import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context";
import { useProfile } from "../../hooks";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { logger } from "../../utils/logger";

export const EditProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { loadMyProfile, updateProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "",
    bio: "",
    avatar: "",
  });

  useEffect(() => {
    void loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const data = await loadMyProfile();
      if (data) {
        setProfile({
          displayName: data.username || "",
          bio: data.bio || "",
          avatar: data.avatar || "",
        });
      }
    } catch (error) {
      logger.warn("Failed to load profile for editing", error);
      Alert.alert(
        "Unable to load profile",
        "Please try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.displayName.trim()) {
      Alert.alert("Error", "Display name is required");
      return;
    }

    setSaving(true);
    try {
      const success = await updateProfile({
        displayName: profile.displayName,
        bio: profile.bio,
      });

      if (success) {
        Alert.alert("Saved", "Profile updated successfully.");
      } else {
        Alert.alert(
          "Update failed",
          "We could not update your profile. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={50} color={colors.textMuted} />
            </View>
          )}
          <TouchableOpacity style={styles.changeAvatarButton}>
            <Text style={styles.changeAvatarText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Display Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={profile.displayName}
            onChangeText={(text) => updateField("displayName", text)}
            placeholder="Enter your name"
            maxLength={50}
          />
          <Text style={styles.charCount}>{profile.displayName.length}/50</Text>
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={profile.bio}
            onChangeText={(text) => updateField("bio", text)}
            placeholder="Tell others about yourself..."
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{profile.bio.length}/200</Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your display name and bio will be visible to other users based on
            your privacy settings.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
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
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    content: {
      paddingBottom: 100,
    },
    avatarSection: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: spacing.md,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.borderMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    changeAvatarButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    changeAvatarText: {
      fontSize: 17,
      color: colors.primary,
      fontWeight: "600",
    },
    field: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    label: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: spacing.xs,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    input: {
      fontSize: 17,
      color: colors.textPrimary,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
      borderBottomWidth: 0,
    },
    bioInput: {
      minHeight: 100,
      paddingTop: spacing.xs,
    },
    charCount: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: spacing.xxs,
    },
    infoBox: {
      flexDirection: "row",
      backgroundColor: colors.infoSoft,
      padding: spacing.md,
      margin: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.info,
      lineHeight: 18,
      marginLeft: spacing.sm,
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
