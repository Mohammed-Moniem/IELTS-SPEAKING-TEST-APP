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
import { PointsProvider, ThemeProvider, useTheme } from "./src/context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
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

  useEffect(() => {
    // Connect socket when user is authenticated
    if (user && accessToken) {
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
      if (!user) {
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
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
        </PointsProvider>
      </AudioCacheInitializer>
    );
  }

  return (
    <AudioCacheInitializer>
      <AppNavigator />
      <OfflineBanner />
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
      logger.warn("⚠️", "Notification initialization skipped:", error);
    });

    // Set up notification listeners
    const notificationListener =
      notificationService.addNotificationReceivedListener((notification) => {
        logger.info("📬", "Notification received:", notification);
      });

    const responseListener =
      notificationService.addNotificationResponseListener((response) => {
        logger.info("👆", "Notification tapped:", response);

        const data = response.notification.request.content.data;
        const category =
          typeof data?.category === "string" ? data.category.toLowerCase() : "";

        if (!category || !navigationRef.isReady()) {
          return;
        }

        const currentRoute = navigationRef.getCurrentRoute()?.name;
        const inAuthFlow = ["Onboarding", "TrialEntry", "Login", "Register"].includes(
          String(currentRoute)
        );
        if (inAuthFlow) {
          return;
        }

        try {
          const navigator = navigationRef as any;

          if (/(chat|social|friend|group)/.test(category)) {
            navigator.navigate("MainTabs", { screen: "Social" });
            return;
          }

          if (/(points|reward|achievement|coupon)/.test(category)) {
            navigator.navigate("PointsDetail");
            return;
          }

          if (/(result|feedback|practice|test)/.test(category)) {
            navigator.navigate("MainTabs", { screen: "Results" });
            return;
          }

          navigator.navigate("MainTabs", { screen: "Home" });
        } catch (error) {
          logger.warn("⚠️", "Failed to route notification response:", error);
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
