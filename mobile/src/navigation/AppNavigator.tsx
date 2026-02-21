import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../auth/AuthContext";
import { CustomTabBar } from "../components/CustomTabBar";
import { PointsPill } from "../components/PointsPill";
import { ProfileMenu } from "../components/ProfileMenu";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import { AnalyticsScreen } from "../screens/Analytics/AnalyticsScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { RegisterScreen } from "../screens/Auth/RegisterScreen";
import { TrialEntryScreen } from "../screens/Auth/TrialEntryScreen";
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
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { SubscriptionScreen } from "../screens/Subscription/SubscriptionScreen";
import { UsageScreen } from "../screens/Usage/UsageScreen";
import { VoiceTestScreen } from "../screens/VoiceTest/VoiceTestScreen";
import monitoringService from "../services/monitoringService";
import type { ColorTokens } from "../theme/tokens";
import { PracticeNavigator } from "./PracticeNavigator";
import { SimulationNavigator } from "./SimulationNavigator";
import { SocialNavigator } from "./SocialNavigator";
import { navigationRef } from "./navigationRef";

export type AuthStackParamList = {
  Onboarding: undefined;
  TrialEntry: undefined;
  Login: undefined;
  Register: { referralCode?: string } | undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
type GuestStackParamList = {
  GuestVoiceTest:
    | {
        autoStartMode?: "practice" | "simulation" | "fulltest" | "fulltest-v2";
      }
    | undefined;
};
const GuestStack = createNativeStackNavigator<GuestStackParamList>();

const ONBOARDING_KEY = "hasSeenOnboarding";
export type AppTabParamList = {
  Home: undefined;
  VoiceTest:
    | {
        retryData?: {
          part: 1 | 2 | 3;
          topic: string;
          question: string;
        };
        autoStartMode?: "practice" | "simulation" | "fulltest" | "fulltest-v2";
      }
    | undefined;
  Practice: undefined;
  Results: undefined;
  Social: undefined;
  // Hidden screens (accessible via ProfileMenu or navigation)
  Profile: undefined;
  Analytics: undefined;
  Settings: undefined;
  Subscription: undefined;
  Usage: undefined;
  Simulations: undefined;
  PointsDetail: undefined;
  RedeemDiscount: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

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

const TabIcon = ({
  label,
  color,
  focused,
  styles,
}: {
  label: string;
  color: string;
  focused: boolean;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    <Text style={{ fontSize: focused ? 22 : 20, color }}>{label}</Text>
  </View>
);

const AppTabs = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerRight: () => <ProfileMenu />,
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
        },
      }}
    >
      {/* Visible tabs */}
      <Tab.Screen
        name="Practice"
        component={PracticeNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="VoiceTest"
        component={VoiceTestScreen}
        options={{ headerTitle: "Voice AI" }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          headerRight: () => (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <PointsPill onPress={() => navigation.navigate("PointsDetail")} />
              <ProfileMenu />
            </View>
          ),
        })}
      />
      <Tab.Screen name="Results" component={ResultsScreen} />
      <Tab.Screen
        name="Social"
        component={SocialNavigator}
        options={{ headerShown: false }}
      />

      {/* Hidden tabs - accessible via ProfileMenu */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={({ navigation }) => ({
          tabBarButton: () => null, // Hide from tab bar
          headerRight: () => (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <PointsPill onPress={() => navigation.navigate("PointsDetail")} />
              <ProfileMenu />
            </View>
          ),
        })}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Usage"
        component={UsageScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Simulations"
        component={SimulationNavigator}
        options={{
          headerShown: false,
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="PointsDetail"
        component={PointsDetailScreen}
        options={{
          headerShown: false,
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="RedeemDiscount"
        component={RedeemDiscountScreen}
        options={{
          headerShown: false,
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
};

// Onboarding flow component
const OnboardingFlow = ({ navigation }: any) => {
  const [currentScreen, setCurrentScreen] = useState(1);

  const handleNext = async () => {
    if (currentScreen < 3) {
      setCurrentScreen(currentScreen + 1);
    } else {
      // Mark onboarding as complete and navigate to login
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      navigation.replace("TrialEntry");
    }
  };

  const handleSkip = async () => {
    // Mark onboarding as complete and navigate directly to login
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    navigation.replace("TrialEntry");
  };

  if (currentScreen === 1) {
    return <SplashScreen1 onNext={handleNext} onSkip={handleSkip} />;
  } else if (currentScreen === 2) {
    return <SplashScreen2 onNext={handleNext} onSkip={handleSkip} />;
  } else {
    return <SplashScreen3 onNext={handleNext} onSkip={handleSkip} />;
  }
};

const AuthNavigator = () => {
  // Always show onboarding - no AsyncStorage check
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(false);

  // Note: Removed useEffect that checks AsyncStorage
  // This ensures onboarding ALWAYS shows on app start

  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      {!hasSeenOnboarding && (
        <AuthStack.Screen name="Onboarding" component={OnboardingFlow} />
      )}
      <AuthStack.Screen name="TrialEntry" component={TrialEntryScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

const GuestExperience = () => {
  const { colors } = useTheme();
  return (
    <GuestStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: false,
      }}
    >
      <GuestStack.Screen
        name="GuestVoiceTest"
        component={VoiceTestScreen}
        initialParams={{ autoStartMode: "fulltest" }}
      />
    </GuestStack.Navigator>
  );
};

export const AppNavigator = () => {
  const { user, initializing } = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const pendingReferralRef = useRef<string | null>(null);
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

  const processReferralUrl = useCallback(
    (url: string | null) => {
      if (!url) {
        return;
      }

      try {
        const parsed = Linking.parse(url);
        const { path, queryParams } = parsed;
        let code: unknown = queryParams?.ref ?? queryParams?.code;

        if (!code && typeof path === "string") {
          const segments = path.split("/").filter(Boolean);
          if (
            segments.length >= 2 &&
            segments[0].toLowerCase() === "referral"
          ) {
            code = segments[1];
          }
          if (
            !code &&
            segments.length >= 1 &&
            segments[0].toLowerCase() === "register"
          ) {
            code = queryParams?.ref;
          }
        }

        if (typeof code === "string" && code.trim()) {
          const normalized = code.trim().toUpperCase();
          pendingReferralRef.current = normalized;

          if (navReady && !user && navigationRef.isReady()) {
            const currentRoute = navigationRef.getCurrentRoute()?.name;
            if (currentRoute !== "Register") {
              navigationRef.navigate("Register", { referralCode: normalized });
            }
          }
        }
      } catch (error) {
        monitoringService.trackEvent("deep_link_error", {
          url,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [navReady, navigationRef, user]
  );

  useEffect(() => {
    Linking.getInitialURL()
      .then(processReferralUrl)
      .catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      processReferralUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [processReferralUrl]);

  useEffect(() => {
    if (
      navReady &&
      !user &&
      pendingReferralRef.current &&
      navigationRef.isReady()
    ) {
      const currentRoute = navigationRef.getCurrentRoute()?.name;
      if (currentRoute !== "Register") {
        navigationRef.navigate("Register", {
          referralCode: pendingReferralRef.current,
        });
      }
    }

    if (user) {
      pendingReferralRef.current = null;
    }
  }, [navReady, navigationRef, user]);

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
        if (!currentRoute) {
          return;
        }

        if (routeNameRef.current !== currentRoute) {
          monitoringService.trackScreen(currentRoute);
        }

        routeNameRef.current = currentRoute;
      }}
    >
      {user ? (user.isGuest ? <GuestExperience /> : <AppTabs />) : <AuthNavigator />}
    </NavigationContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  RNStyleSheet.create({
    iconContainer: {
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
    },
    iconContainerFocused: {
      backgroundColor: `${colors.primary}15`, // 15% opacity
    },
    homeIconContainer: {
      width: 60,
      height: 60,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 30,
      marginTop: -20, // Lift it above the tab bar
      backgroundColor: colors.backgroundMuted,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    homeIconContainerFocused: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 10,
    },
  });
