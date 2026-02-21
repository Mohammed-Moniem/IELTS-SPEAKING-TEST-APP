import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  UserPresence,
  userPresenceService,
} from "../../services/userPresenceService";

interface OnlineStatusBadgeProps {
  userId: string;
  showText?: boolean;
  size?: "small" | "medium" | "large";
  style?: ViewStyle;
}

/**
 * OnlineStatusBadge Component
 * Displays online status indicator (green dot) and optional last seen text
 */
export const OnlineStatusBadge: React.FC<OnlineStatusBadgeProps> = ({
  userId,
  showText = false,
  size = "medium",
  style,
}) => {
  const [presence, setPresence] = useState<UserPresence | null>(
    userPresenceService.getPresence(userId)
  );

  useEffect(() => {
    // Subscribe to presence updates for this user
    const unsubscribe = userPresenceService.subscribe(
      (updatedUserId, updatedPresence) => {
        if (updatedUserId === userId) {
          setPresence(updatedPresence);
        }
      }
    );

    // Get initial presence
    setPresence(userPresenceService.getPresence(userId));

    return unsubscribe;
  }, [userId]);

  const isOnline = presence?.isOnline || false;
  const lastSeenText = userPresenceService.formatLastSeen(userId);

  // Determine badge size
  const badgeSize = size === "small" ? 8 : size === "medium" ? 10 : 12;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: isOnline ? "#25D366" : "#95A5A6",
          },
        ]}
      />
      {showText && (
        <Text
          style={[styles.text, { color: isOnline ? "#25D366" : "#95A5A6" }]}
        >
          {lastSeenText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  text: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: "500",
  },
});
