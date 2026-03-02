module.exports = ({ config }) => {
  const sentryOrg = process.env.SENTRY_ORG || "";
  const sentryProject = process.env.SENTRY_PROJECT || "";

  const basePlugins = [
    ...(Array.isArray(config.plugins) ? config.plugins : []),
    "expo-font",
    "@react-native-firebase/app",
    "expo-secure-store",
    "expo-web-browser",
  ];

  // Enable the Sentry Expo build plugin only when org/project are configured.
  // Runtime Sentry capture still works from EXPO_PUBLIC_SENTRY_DSN without this.
  if (sentryOrg && sentryProject) {
    basePlugins.push([
      "@sentry/react-native/expo",
      {
        organization: sentryOrg,
        project: sentryProject,
        url: process.env.SENTRY_URL || "https://sentry.io/",
      },
    ]);
  }

  return {
    ...config,
    plugins: basePlugins,
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
  };
};
