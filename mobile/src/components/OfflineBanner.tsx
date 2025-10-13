/**
 * Offline Banner Component
 * Shows banner when device is offline
 */

import React, { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import offlineStorage from "../services/offlineStorage";

const { width } = Dimensions.get("window");

interface OfflineBannerProps {
  showQueueCount?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  showQueueCount = true,
}) => {
  const { isOffline, isOnline } = useNetworkStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (isOffline) {
      // Slide down when offline
      setShouldShow(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Update queue count
      if (showQueueCount) {
        updateQueueCount();
      }
    } else if (isOnline) {
      // Slide down briefly to show "Back online" message
      setShouldShow(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Then slide up after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShouldShow(false);
        });
      }, 3000); // Show "Back online" message for 3 seconds

      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline]);

  const updateQueueCount = async () => {
    const stats = await offlineStorage.getStats();
    setQueueCount(stats.queuedEvaluations);
  };

  // Don't render if we're in loading state or if banner should be hidden
  if ((isOffline === false && isOnline === false) || !shouldShow) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        isOffline ? styles.offlineBanner : styles.onlineBanner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{isOffline ? "📡" : "✅"}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isOffline ? "You are offline" : "Back online"}
          </Text>
          {isOffline && (
            <Text style={styles.subtitle}>
              {queueCount > 0
                ? `${queueCount} recording${
                    queueCount > 1 ? "s" : ""
                  } will sync when online`
                : "Recordings will be saved locally"}
            </Text>
          )}
          {isOnline && (
            <Text style={styles.subtitle}>Syncing your recordings...</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 90 : 60, // Position below header
    left: 10,
    right: 10,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9999, // Very high z-index to be above everything
  },
  offlineBanner: {
    backgroundColor: "#FEF3C7", // Light yellow
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B", // Amber
  },
  onlineBanner: {
    backgroundColor: "#D1FAE5", // Light green
    borderLeftWidth: 4,
    borderLeftColor: "#10B981", // Green
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
});

export default OfflineBanner;
