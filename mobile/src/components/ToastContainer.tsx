/**
 * Toast Component
 * Displays non-intrusive notifications at the top of the screen
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../context";
import { Toast, toastService } from "../services/toastService";
import { spacing } from "../theme/tokens";

const { width } = Dimensions.get("window");

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { colors } = useTheme();
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      dismiss();
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const getIcon = (): string => {
    switch (toast.type) {
      case "success":
        return "checkmark-circle";
      case "error":
        return "close-circle";
      case "warning":
        return "warning";
      default:
        return "information-circle";
    }
  };

  const getBackgroundColor = (): string => {
    switch (toast.type) {
      case "success":
        return colors.success || "#10b981";
      case "error":
        return colors.danger;
      case "warning":
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: getBackgroundColor(),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={dismiss}
        activeOpacity={0.9}
      >
        <Ionicons
          name={getIcon() as any}
          size={20}
          color="#fff"
          style={styles.icon}
        />
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  const handleToast = useCallback((toast: Toast) => {
    setToasts((prev) => {
      // Keep only the last 3 toasts
      const newToasts = [...prev, toast];
      return newToasts.slice(-3);
    });
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = toastService.subscribe(handleToast);
    return unsubscribe;
  }, [handleToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.container, { top: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    ...Platform.select({
      web: {
        position: "fixed" as any,
      },
    }),
  },
  toastItem: {
    width: width - spacing.xl * 2,
    marginBottom: spacing.sm,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    marginRight: spacing.xs,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
});
