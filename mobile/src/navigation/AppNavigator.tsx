import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { CustomTabBar } from "../components/CustomTabBar";
import { PointsPill } from "../components/PointsPill";
import { ProfileMenu } from "../components/ProfileMenu";
import { useTheme } from "../context";
import { supabase } from "../lib/supabase";
import { AnalyticsScreen } from "../screens/Analytics/AnalyticsScreen";
import { GuestLockedScreen } from "../screens/GuestLockedScreen";
import { DataPrivacyScreen } from "../screens/Account/DataPrivacyScreen";
import { EntryScreen } from "../screens/Auth/EntryScreen";
import { ForgotPasswordScreen } from "../screens/Auth/ForgotPasswordScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { RegisterScreen } from "../screens/Auth/RegisterScreen";
import { ResetPasswordScreen } from "../screens/Auth/ResetPasswordScreen";
import { UpgradeAccountScreen } from "../screens/Auth/UpgradeAccountScreen";
import { HomeScreen } from "../screens/Home/HomeScreen";
import {
  SplashScreen1,
  SplashScreen2,
  SplashScreen3,
} from "../screens/Onboarding/SplashScreens";
import { PointsDetailScreen } from "../screens/PointsDetailScreen";
import { ProfileScreen } from "../screens/Profile/ProfileScreen";
import { RedeemDiscountScreen } from "../screens/RedeemDiscountScreen";
import { ResultsScreen } from "../screens/Results/ResultsScreen";
import { MyRecordingsScreen } from "../screens/MyRecordings/MyRecordingsScreen";
import { NotificationSettingsScreen } from "../screens/Settings/NotificationSettingsScreen";
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { HelpSupportScreen } from "../screens/Support/HelpSupportScreen";
import { UsageScreen } from "../screens/Usage/UsageScreen";
import { VoiceTestScreen } from "../screens/VoiceTest/VoiceTestScreen";
import monitoringService from "../services/monitoringService";
import { PracticeNavigator } from "./PracticeNavigator";
import { SimulationNavigator, type SimulationStackParamList } from "./SimulationNavigator";
import { navigationRef } from "./navigationRef";

export const ONBOARDING_KEY = "hasSeenOnboarding";

export type AuthStackParamList = {
  Onboarding: { mode?: "auth" } | undefined;
  Entry: undefined;
  Login: undefined;
  Register: { referralCode?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

export type MainTabParamList = {
  Practice: undefined;
  VoiceTest:
    | {
        retryData?: {
          part: 1 | 2 | 3;
          topic: string;
          question: string;
        };
      }
    | undefined;
  Home: undefined;
  Simulations: NavigatorScreenParams<SimulationStackParamList> | undefined;
  Results: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Profile: undefined;
  Analytics: undefined;
  Social: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
  Usage: undefined;
  MyRecordings: undefined;
  HelpSupport: undefined;
  DataPrivacy: undefined;
  PointsDetail: undefined;
  RedeemDiscount: undefined;
  OnboardingReplay: { mode?: "replay" } | undefined;
  UpgradeAccount: undefined;
  ResetPassword: undefined;
};

type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const SplashScreen = () => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.backgroundMuted,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const AnalyticsGate = () => {
  const { user } = useAuth();

  if (user?.isGuest) {
    return (
      <GuestLockedScreen
        title="Analytics is locked in guest mode"
        description="Create an account to unlock detailed analytics and track your progress over time."
        onCta={() => {
          navigationRef.navigate("App", { screen: "UpgradeAccount" } as any);
        }}
      />
    );
  }

  return <AnalyticsScreen />;
};

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerRight: () => <ProfileMenu />,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
        },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Practice"
        component={PracticeNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="VoiceTest"
        component={VoiceTestScreen}
        options={{ headerTitle: "Speak practice" }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <PointsPill
                onPress={() =>
                  navigationRef.navigate("App", { screen: "PointsDetail" } as any)
                }
              />
              <ProfileMenu />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Simulations"
        component={SimulationNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Results" component={ResultsScreen} />
    </Tab.Navigator>
  );
};

const OnboardingScreen = ({ navigation, route }: any) => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const mode: "auth" | "replay" = route?.params?.mode === "replay" ? "replay" : "auth";

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    if (mode === "replay") {
      navigation.goBack();
      return;
    }
    navigation.replace("Entry");
  };

  const handleNext = async () => {
    if (currentScreen < 3) {
      setCurrentScreen((v) => v + 1);
      return;
    }
    await finish();
  };

  const handleSkip = async () => {
    await finish();
  };

  if (currentScreen === 1) {
    return <SplashScreen1 onNext={handleNext} onSkip={handleSkip} />;
  }
  if (currentScreen === 2) {
    return <SplashScreen2 onNext={handleNext} onSkip={handleSkip} />;
  }
  return <SplashScreen3 onNext={handleNext} onSkip={handleSkip} />;
};

const AuthNavigator = () => {
  const [checked, setChecked] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!mounted) return;
        setHasSeenOnboarding(value === "true");
      } finally {
        if (mounted) setChecked(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!checked) {
    return <SplashScreen />;
  }

  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      {!hasSeenOnboarding ? (
        <AuthStack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          initialParams={{ mode: "auth" }}
        />
      ) : null}
      <AuthStack.Screen name="Entry" component={EntryScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
};

const AppStackNavigator = () => {
  const { colors } = useTheme();

  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () => <ProfileMenu />,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AppStack.Screen
        name="Tabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
      <AppStack.Screen
        name="Analytics"
        component={AnalyticsGate}
        options={{ headerTitle: "Analytics" }}
      />
      <AppStack.Screen
        name="Social"
        component={SocialGate}
        options={{ headerShown: false }}
      />
      <AppStack.Screen name="Settings" component={SettingsScreen} />
      <AppStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ headerTitle: "Notifications" }}
      />
      <AppStack.Screen name="Usage" component={UsageScreen} />
      <AppStack.Screen
        name="MyRecordings"
        component={MyRecordingsScreen}
        options={{ headerTitle: "My recordings" }}
      />
      <AppStack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ headerTitle: "Help & support" }}
      />
      <AppStack.Screen
        name="DataPrivacy"
        component={DataPrivacyScreen}
        options={{ headerTitle: "Data & privacy" }}
      />
      <AppStack.Screen
        name="PointsDetail"
        component={PointsDetailScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="RedeemDiscount"
        component={RedeemDiscountScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="OnboardingReplay"
        component={OnboardingScreen}
        initialParams={{ mode: "replay" }}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="UpgradeAccount"
        component={UpgradeAccountScreen}
        options={{ headerTitle: "Create account" }}
      />
      <AppStack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ headerTitle: "Reset password" }}
      />
    </AppStack.Navigator>
  );
};

export const AppNavigator = () => {
  const { user, initializing } = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const pendingReferralRef = useRef<string | null>(null);
  const pendingPasswordResetRef = useRef<boolean>(false);
  const [navReady, setNavReady] = useState(false);
  const { colors, theme } = useTheme();

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: theme === "dark",
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.divider,
        primary: colors.primary,
        notification: colors.secondary ?? colors.primary,
      },
    }),
    [colors, theme]
  );

  const navigateToRegister = useCallback(
    (referralCode: string) => {
      navigationRef.navigate("Auth", {
        screen: "Register",
        params: { referralCode },
      } as any);
    },
    []
  );

  const processDeepLink = useCallback(
    (url: string | null) => {
      if (!url) return;

      try {
        const parsed = Linking.parse(url);
        const { path, queryParams } = parsed;

        // Supabase Auth callbacks (Google OAuth, password recovery) use a code exchange.
        if (typeof path === "string") {
          const lower = path.toLowerCase();
          if (lower.startsWith("auth/callback") || lower.startsWith("auth/reset")) {
            pendingPasswordResetRef.current = lower.startsWith("auth/reset");
            void supabase.auth.exchangeCodeForSession(url).catch((error) => {
              monitoringService.trackEvent("supabase_exchange_failed", {
                url,
                message: error instanceof Error ? error.message : String(error),
              });
            });
            return;
          }
        }

        let code: unknown = queryParams?.ref ?? queryParams?.code;
        if (!code && typeof path === "string") {
          const segments = path.split("/").filter(Boolean);
          if (segments.length >= 2 && segments[0].toLowerCase() === "referral") {
            code = segments[1];
          }
        }

        if (typeof code === "string" && code.trim()) {
          const normalized = code.trim().toUpperCase();
          pendingReferralRef.current = normalized;

          if (!user && navReady && navigationRef.isReady()) {
            navigateToRegister(normalized);
          }
        }
      } catch (error) {
        monitoringService.trackEvent("deep_link_error", {
          url,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [navReady, navigateToRegister]
  );

  useEffect(() => {
    Linking.getInitialURL().then(processDeepLink).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      processDeepLink(url);
    });
    return () => subscription.remove();
  }, [processDeepLink]);

  useEffect(() => {
    if (navReady && !user && pendingReferralRef.current && navigationRef.isReady()) {
      navigateToRegister(pendingReferralRef.current);
    }

    if (user) {
      pendingReferralRef.current = null;
    }
  }, [navReady, navigateToRegister, user]);

  useEffect(() => {
    if (!navReady || !navigationRef.isReady()) return;
    if (!user) return;
    if (!pendingPasswordResetRef.current) return;

    pendingPasswordResetRef.current = false;
    navigationRef.navigate("App", { screen: "ResetPassword" } as any);
  }, [navReady, user]);

  if (initializing) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer
      theme={navigationTheme}
      ref={navigationRef}
      onReady={() => {
        setNavReady(true);
        const initialRoute = navigationRef.getCurrentRoute()?.name;
        routeNameRef.current = initialRoute;
        if (initialRoute) {
          monitoringService.trackScreen(initialRoute);
        }
      }}
      onStateChange={() => {
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        if (!currentRoute) return;
        if (routeNameRef.current !== currentRoute) {
          monitoringService.trackScreen(currentRoute);
        }
        routeNameRef.current = currentRoute;
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="App" component={AppStackNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
