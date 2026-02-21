export default {
  expo: {
    name: "Spokio",
    slug: "spokio",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "spokio",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#7C3AED",
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          "Allow camera access to scan QR codes for friends and referrals.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#7C3AED",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: ["android.permission.CAMERA"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-font", "sentry-expo"],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1",
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:4000",
      apiKey: process.env.EXPO_PUBLIC_API_KEY || "local-dev-api-key",
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
      guestEmail: process.env.EXPO_PUBLIC_GUEST_EMAIL || "",
      guestPassword: process.env.EXPO_PUBLIC_GUEST_PASSWORD || "",
    },
  },
};
