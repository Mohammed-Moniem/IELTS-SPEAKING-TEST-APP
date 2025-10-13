import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useProfile } from "../../hooks";

export const EditProfileScreen: React.FC = () => {
  const { loadMyProfile, updateProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "",
    bio: "",
    avatar: "",
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    const data = await loadMyProfile();
    if (data) {
      setProfile({
        displayName: data.username || "",
        bio: data.bio || "",
        avatar: data.avatar || "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile.displayName.trim()) {
      Alert.alert("Error", "Display name is required");
      return;
    }

    setSaving(true);
    const success = await updateProfile({
      displayName: profile.displayName,
      bio: profile.bio,
    });
    setSaving(false);

    if (success) {
      Alert.alert("Success", "Profile updated successfully");
    }
  };

  const updateField = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={50} color="#8E8E93" />
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
          <Ionicons name="information-circle" size={20} color="#007AFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    paddingBottom: 100,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  changeAvatarButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeAvatarText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
  },
  field: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  label: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  input: {
    fontSize: 17,
    color: "#000000",
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
  },
  bioInput: {
    minHeight: 100,
    paddingTop: 8,
  },
  charCount: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "right",
    marginTop: 4,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#E5F2FF",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#007AFF",
    lineHeight: 18,
    marginLeft: 12,
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
