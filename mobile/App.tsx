import "react-native-gesture-handler";

import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AudioCacheInitializer } from "./src/components/AudioCacheInitializer";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { ToastContainer } from "./src/components/ToastContainer";
import { PointsProvider, ThemeProvider, useTheme } from "./src/context";
import { useOfflineSync } from "./src/hooks/useOfflineSync";
import { AppNavigator } from "./src/navigation/AppNavigator";
import firebaseAnalyticsService from "./src/services/firebaseAnalyticsService";
import monitoringService from "./src/services/monitoringService";
import notificationService from "./src/services/notificationService";
import socketService from "./src/services/socketService";
import { logger } from "./src/utils/logger";

// Initialize monitoring (Sentry)
monitoringService.initialize();

// Initialize analytics (Firebase Analytics) safely
void firebaseAnalyticsService.initialize();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

const onAppStateChange = (status: AppStateStatus) => {
  focusManager.setFocused(status === "active");
};

// Wrapper component to handle socket connection after auth
const AppContent = () => {
  const { user, accessToken } = useAuth();
  const { theme } = useTheme();

  useOfflineSync();

  useEffect(() => {
    // Connect socket only when social features are unlocked (avoid guest mode noise).
    if (user && accessToken && !user.isGuest) {
      const initSocket = async () => {
        const connected = await socketService.connect();
        if (connected) {
          logger.success("✅", "Socket.io connected for user:", user.email);
        }
      };
      initSocket();
    }

    // Disconnect socket when user logs out
    return () => {
      if (!user || user.isGuest) {
        socketService.disconnect();
        logger.info("🔌", "Socket.io disconnected");
      }
    };
  }, [user, accessToken]);

  // Only render PointsProvider when user is authenticated to prevent hook ordering issues
  if (user) {
    return (
      <AudioCacheInitializer>
        <PointsProvider>
          <AppNavigator />
          <OfflineBanner />
          <ToastContainer />
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
        </PointsProvider>
      </AudioCacheInitializer>
    );
  }

  return (
    <AudioCacheInitializer>
      <AppNavigator />
      <OfflineBanner />
      <ToastContainer />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </AudioCacheInitializer>
  );
};

const App = () => {
  useEffect(() => {
    monitoringService.trackEvent("app_launch");
    void firebaseAnalyticsService.trackEvent("app_launch");

    const subscription = AppState.addEventListener("change", onAppStateChange);

    // Initialize notifications
    notificationService.initialize().catch((error) => {
      logger.error("❌", "Failed to initialize notifications:", error);
    });

    // Set up notification listeners
    const notificationListener =
      notificationService.addNotificationReceivedListener((notification) => {
        logger.info("📬", "Notification received:", notification);
      });

    const responseListener =
      notificationService.addNotificationResponseListener((response) => {
        logger.info("👆", "Notification tapped:", response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data?.category) {
          logger.info("Category:", data.category);
          // TODO: Navigate to appropriate screen based on category
        }
      });

    return () => {
      subscription.remove();
      notificationListener.remove();
      responseListener.remove();
      socketService.disconnect();
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <AppContent />
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default App;
