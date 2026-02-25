import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_WIDTH = SCREEN_WIDTH / 5; // Exactly 5 tabs

export const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const getIconName = (routeName: string, focused: boolean) => {
    switch (routeName) {
      case "Practice":
        return focused ? "book" : "book-outline";
      case "VoiceTest":
        return focused ? "microphone" : "microphone-outline";
      case "Home":
        return focused ? "home" : "home-outline";
      case "Results":
        return focused ? "trophy" : "trophy-outline";
      case "Social":
        return focused ? "people" : "people-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case "VoiceTest":
        return "Voice Test";
      case "Practice":
        return "Practice";
      case "Home":
        return "Home";
      case "Results":
        return "Results";
      case "Social":
        return "Social";
      default:
        return routeName;
    }
  };

  const renderIcon = (routeName: string, focused: boolean, color: string) => {
    const iconName = getIconName(routeName, focused);
    const size = 24;

    if (routeName === "VoiceTest" || routeName === "Results") {
      return (
        <MaterialCommunityIcons
          name={iconName as any}
          size={size}
          color={color}
        />
      );
    }

    return <Ionicons name={iconName as any} size={size} color={color} />;
  };

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        const color = isFocused ? colors.primary : colors.tabInactive;
        const routeLabel = getLabel(route.name);
        const accessibilityLabel =
          options.tabBarAccessibilityLabel || `${routeLabel} tab`;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={
              isFocused
                ? `${routeLabel} is currently selected`
                : `Switch to ${routeLabel}`
            }
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <View style={styles.tabContent}>
              {renderIcon(route.name, isFocused, color)}
              <Text
                allowFontScaling
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={[
                  styles.label,
                  { color },
                  isFocused && styles.labelFocused,
                ]}
              >
                {getLabel(route.name)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    tabBar: {
      flexDirection: "row",
      height: 65,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingBottom: 8,
      paddingTop: 5,
      width: SCREEN_WIDTH,
    },
    tab: {
      width: TAB_WIDTH,
      minHeight: 48,
      justifyContent: "center",
      alignItems: "center",
    },
    tabContent: {
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 10,
      fontWeight: "600",
      marginTop: 4,
    },
    labelFocused: {
      fontWeight: "700",
    },
  });
