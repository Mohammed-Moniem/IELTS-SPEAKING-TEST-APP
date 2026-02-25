module.exports = ({ config }) => ({
  ...config,
  plugins: Array.from(
    new Set([
      ...(Array.isArray(config.plugins) ? config.plugins : []),
      "expo-font",
      "@react-native-firebase/app",
      "@sentry/react-native",
      "expo-secure-store",
      "expo-web-browser",
    ])
  ),
  ios: {
    ...(config.ios || {}),
    ...(process.env.IOS_BUNDLE_IDENTIFIER
      ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER }
      : {}),
    googleServicesFile:
      process.env.GOOGLE_SERVICE_INFO_PLIST ||
      config.ios?.googleServicesFile,
  },
  android: {
    ...(config.android || {}),
    ...(process.env.ANDROID_PACKAGE_NAME
      ? { package: process.env.ANDROID_PACKAGE_NAME }
      : {}),
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ||
      config.android?.googleServicesFile,
  },
  extra: {
    ...(config.extra || {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1",
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:4000",
    apiKey: process.env.EXPO_PUBLIC_API_KEY || "local-dev-api-key",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
    guestEmail: process.env.EXPO_PUBLIC_GUEST_EMAIL || "",
    guestPassword: process.env.EXPO_PUBLIC_GUEST_PASSWORD || "",
  },
});
