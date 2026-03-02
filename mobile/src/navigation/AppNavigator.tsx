import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
};

export type AppRootStackParamList = {
  MainTabs: undefined;
  Profile: undefined;
  Analytics: undefined;
  Settings: undefined;
  Subscription: undefined;
  Usage: undefined;
  Simulations: undefined;
  PointsDetail: undefined;
  RedeemDiscount: undefined;
  OnboardingReplay: undefined;
};

type GuestStackParamList = {
  GuestVoiceTest:
    | {
        autoStartMode?: "practice" | "simulation" | "fulltest" | "fulltest-v2";
      }
    | undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();
const GuestStack = createNativeStackNavigator<GuestStackParamList>();
const RootStack = createNativeStackNavigator<AppRootStackParamList>();

const ONBOARDING_KEY = "hasSeenOnboarding";

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

const AppTabs = () => {
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
        headerShadowVisible: false,
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
        },
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
        options={{ headerTitle: "Voice Test" }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <PointsPill
                onPress={() =>
                  (navigation.getParent() as any)?.navigate("PointsDetail")
                }
              />
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
    </Tab.Navigator>
  );
};

type OnboardingFlowProps = {
  onComplete: () => void;
  onSkip?: () => void;
  onSignIn?: () => void;
  onRegister?: () => void;
};

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onSkip,
  onSignIn,
  onRegister,
}) => {
  const [currentScreen, setCurrentScreen] = useState(1);

  const handleNext = () => {
    if (currentScreen < 3) {
      setCurrentScreen((prev) => prev + 1);
      return;
    }

    onComplete();
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
      return;
    }

    onComplete();
  };

  if (currentScreen === 1) {
    return (
      <SplashScreen1
        onNext={handleNext}
        onSkip={handleSkip}
        onSignIn={onSignIn}
        onRegister={onRegister}
      />
    );
  }

  if (currentScreen === 2) {
    return (
      <SplashScreen2
        onNext={handleNext}
        onSkip={handleSkip}
        onSignIn={onSignIn}
        onRegister={onRegister}
      />
    );
  }

  return (
    <SplashScreen3
      onNext={handleNext}
      onSkip={handleSkip}
      onSignIn={onSignIn}
      onRegister={onRegister}
    />
  );
};

const OnboardingReplayScreen = ({ navigation }: { navigation: any }) => {
  return (
    <OnboardingFlow
      onComplete={() => navigation.goBack()}
      onSkip={() => navigation.goBack()}
    />
  );
};

const AuthNavigator = () => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        if (!mounted) {
          return;
        }
        setHasSeenOnboarding(value === "true");
      })
      .catch(() => {
        if (mounted) {
          setHasSeenOnboarding(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (hasSeenOnboarding === null) {
    return <SplashScreen />;
  }

  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      {!hasSeenOnboarding && (
        <AuthStack.Screen name="Onboarding">
          {({ navigation }) => (
            <OnboardingFlow
              onComplete={async () => {
                await AsyncStorage.setItem(ONBOARDING_KEY, "true");
                setHasSeenOnboarding(true);
                navigation.replace("TrialEntry");
              }}
              onSkip={async () => {
                await AsyncStorage.setItem(ONBOARDING_KEY, "true");
                setHasSeenOnboarding(true);
                navigation.replace("TrialEntry");
              }}
              onSignIn={async () => {
                await AsyncStorage.setItem(ONBOARDING_KEY, "true");
                setHasSeenOnboarding(true);
                navigation.replace("Login");
              }}
              onRegister={async () => {
                await AsyncStorage.setItem(ONBOARDING_KEY, "true");
                setHasSeenOnboarding(true);
                navigation.replace("Register");
              }}
            />
          )}
        </AuthStack.Screen>
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

const AuthenticatedNavigator = () => {
  const { colors } = useTheme();

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
        },
        headerRight: () => <ProfileMenu />,
      }}
    >
      <RootStack.Screen
        name="MainTabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen name="Profile" component={ProfileScreen} />
      <RootStack.Screen name="Analytics" component={AnalyticsScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
      <RootStack.Screen name="Subscription" component={SubscriptionScreen} />
      <RootStack.Screen name="Usage" component={UsageScreen} />
      <RootStack.Screen
        name="Simulations"
        component={SimulationNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="PointsDetail"
        component={PointsDetailScreen}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="RedeemDiscount"
        component={RedeemDiscountScreen}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="OnboardingReplay"
        component={OnboardingReplayScreen}
        options={{ headerShown: false }}
      />
    </RootStack.Navigator>
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
          if (segments.length >= 2 && segments[0].toLowerCase() === "referral") {
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
    [navReady, user]
  );

  useEffect(() => {
    Linking.getInitialURL().then(processReferralUrl).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      processReferralUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [processReferralUrl]);

  useEffect(() => {
    if (navReady && !user && pendingReferralRef.current && navigationRef.isReady()) {
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
        if (!currentRoute) {
          return;
        }

        if (routeNameRef.current !== currentRoute) {
          monitoringService.trackScreen(currentRoute);
        }

        routeNameRef.current = currentRoute;
      }}
    >
      {user ? user.isGuest ? <GuestExperience /> : <AuthenticatedNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
