/**
 * Offline Banner
 * Single global offline status surface shown at the app shell level.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "../context";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import offlineStorage from "../services/offlineStorage";
import type { ColorTokens } from "../theme/tokens";
import { radii, spacing } from "../theme/tokens";

interface OfflineBannerProps {
  showQueueCount?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  showQueueCount = true,
}) => {
  const { isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [queueCount, setQueueCount] = useState(0);
  const [slideAnim] = useState(new Animated.Value(-120));
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShouldShow(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 55,
        friction: 7,
      }).start();

      if (showQueueCount) {
        offlineStorage
          .getStats()
          .then((stats) => setQueueCount(stats.queuedEvaluations))
          .catch(() => setQueueCount(0));
      }
      return;
    }

    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setShouldShow(false);
    });
  }, [isOffline, showQueueCount, slideAnim]);

  if (!isOffline || !shouldShow) {
    return null;
  }

  const message =
    queueCount > 0
      ? `${queueCount} recording${
          queueCount > 1 ? "s" : ""
        } will sync automatically once you reconnect.`
      : "You can keep practicing. Your work will sync when you're back online.";

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.banner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.statusInfoText} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Offline mode</Text>
        <Text style={styles.subtitle}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    banner: {
      position: "absolute",
      top: Platform.OS === "ios" ? 86 : 58,
      left: spacing.sm,
      right: spacing.sm,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.statusInfoBorder,
      backgroundColor: colors.statusInfoBackground,
      padding: spacing.sm,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
      zIndex: 9999,
    },
    iconWrap: {
      marginTop: 2,
    },
    content: {
      flex: 1,
    },
    title: {
      color: colors.statusInfoText,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 2,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
  });

export default OfflineBanner;
