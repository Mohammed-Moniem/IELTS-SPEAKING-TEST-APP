import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

export const SettingsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();

  const settingsOptions = [
    {
      title: "Privacy Settings",
      description: "Control who can see your profile",
      icon: "shield-checkmark",
      route: "PrivacySettings" as keyof SocialStackParamList,
    },
    {
      title: "Edit Profile",
      description: "Update your display name and info",
      icon: "person",
      route: "EditProfile" as keyof SocialStackParamList,
    },
    {
      title: "Notifications",
      description: "Manage notification preferences",
      icon: "notifications",
    },
    {
      title: "Blocked Users",
      description: "View and manage blocked users",
      icon: "ban",
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {settingsOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionCard}
            onPress={() =>
              option.route && navigation.navigate(option.route as any)
            }
          >
            <View style={styles.optionIcon}>
              <Ionicons name={option.icon as any} size={24} color="#007AFF" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  section: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: "#8E8E93",
  },
  infoCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  infoLabel: {
    fontSize: 17,
    color: "#000000",
  },
  infoValue: {
    fontSize: 17,
    color: "#8E8E93",
  },
});
