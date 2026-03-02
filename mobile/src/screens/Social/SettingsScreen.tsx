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
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

export const SettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {settingsOptions.map((option) => (
          <TouchableOpacity
            key={option.title}
            style={styles.optionCard}
            onPress={() => navigation.navigate(option.route as any)}
          >
            <View style={styles.optionIcon}>
              <Ionicons
                name={option.icon as any}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
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

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundMuted,
    },
    section: {
      paddingVertical: spacing.md,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    optionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.sm,
    },
    optionInfo: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textMuted,
    },
    infoCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    infoLabel: {
      fontSize: 17,
      color: colors.textPrimary,
    },
    infoValue: {
      fontSize: 17,
      color: colors.textMuted,
    },
  });
