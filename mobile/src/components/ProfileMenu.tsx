import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import { navigationRef } from "../navigation/navigationRef";
import type { ColorTokens } from "../theme/tokens";

interface MenuItem {
  icon: string;
  iconFamily: "Ionicons" | "MaterialCommunityIcons";
  label: string;
  screen: string;
  color?: string;
}

const buildMenuItems = (options: { isGuest: boolean }): MenuItem[] => {
  const base: MenuItem[] = [];

  if (options.isGuest) {
    base.push({
      icon: "person-add",
      iconFamily: "Ionicons",
      label: "Create account",
      screen: "UpgradeAccount",
    });
  }

  base.push(
    {
      icon: "person",
      iconFamily: "Ionicons",
      label: "Profile",
      screen: "Profile",
    },
    {
      icon: "people",
      iconFamily: "Ionicons",
      label: "Social",
      screen: "Social",
    },
    {
      icon: "analytics",
      iconFamily: "Ionicons",
      label: "Analytics",
      screen: "Analytics",
    },
    {
      icon: "settings",
      iconFamily: "Ionicons",
      label: "Settings",
      screen: "Settings",
    },
    {
      icon: "bar-chart",
      iconFamily: "Ionicons",
      label: "Usage",
      screen: "Usage",
    },
    {
      icon: "mic",
      iconFamily: "Ionicons",
      label: "Recordings",
      screen: "MyRecordings",
    },
    {
      icon: "log-out",
      iconFamily: "Ionicons",
      label: "Logout",
      screen: "Logout",
      color: "#EF4444", // Red color for logout
    }
  );

  return base;
};

interface ProfileMenuProps {
  containerStyle?: StyleProp<ViewStyle>;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  containerStyle,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const menuItems = buildMenuItems({ isGuest: !!user?.isGuest });

  const handleMenuPress = async (item: MenuItem) => {
    setVisible(false);

    if (item.screen === "Logout") {
      await logout();
      return;
    }

    // Navigate via the root navigation ref so this works from both Tabs and Stack headers.
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate("App", { screen: item.screen } as any);
        return;
      }
      (navigation as any).navigate(item.screen);
    }, 100);
  };

  return (
    <>
      {/* Profile Icon Button */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.profileButton, containerStyle]}
        activeOpacity={0.7}
      >
        <View style={styles.profileIconContainer}>
          <Ionicons name="person-circle" size={32} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menu</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuItems}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    index === menuItems.length - 1 && styles.menuItemLast,
                  ]}
                  onPress={() => handleMenuPress(item)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.menuItemIcon,
                      item.color && { backgroundColor: "#FEE2E2" },
                    ]}
                  >
                    {item.iconFamily === "Ionicons" ? (
                      <Ionicons
                        name={item.icon as any}
                        size={22}
                        color={item.color || colors.primary}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={22}
                        color={item.color || colors.primary}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.menuItemText,
                      item.color && { color: item.color },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  profileButton: {
    marginRight: 16,
    paddingLeft: 8,
  },
  profileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}10`,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItems: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.primary}10`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  });
