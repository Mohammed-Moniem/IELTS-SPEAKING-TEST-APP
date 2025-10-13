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
import { AppNavigator } from "./src/navigation/AppNavigator";
import notificationService from "./src/services/notificationService";
import socketService from "./src/services/socketService";

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

  useEffect(() => {
    // Connect socket when user is authenticated
    if (user && accessToken) {
      const initSocket = async () => {
        const connected = await socketService.connect();
        if (connected) {
          console.log("✅ Socket.io connected for user:", user.email);
        }
      };
      initSocket();
    }

    // Disconnect socket when user logs out
    return () => {
      if (!user) {
        socketService.disconnect();
        console.log("🔌 Socket.io disconnected");
      }
    };
  }, [user, accessToken]);

  return (
    <>
      <AppNavigator />
      <StatusBar style="dark" />
    </>
  );
};

const App = () => {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);

    // Initialize notifications
    notificationService.initialize().catch(console.error);

    // Set up notification listeners
    const notificationListener =
      notificationService.addNotificationReceivedListener((notification) => {
        console.log("📬 Notification received:", notification);
      });

    const responseListener =
      notificationService.addNotificationResponseListener((response) => {
        console.log("👆 Notification tapped:", response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data?.category) {
          console.log("Category:", data.category);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
