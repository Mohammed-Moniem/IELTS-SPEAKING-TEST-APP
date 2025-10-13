import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../auth/AuthContext";
import { CustomTabBar } from "../components/CustomTabBar";
import { ProfileMenu } from "../components/ProfileMenu";
import { AnalyticsScreen } from "../screens/Analytics/AnalyticsScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { RegisterScreen } from "../screens/Auth/RegisterScreen";
import { HomeScreen } from "../screens/Home/HomeScreen";
import { ProfileScreen } from "../screens/Profile/ProfileScreen";
import { ResultsScreen } from "../screens/Results/ResultsScreen";
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { SubscriptionScreen } from "../screens/Subscription/SubscriptionScreen";
import { UsageScreen } from "../screens/Usage/UsageScreen";
import { VoiceTestScreen } from "../screens/VoiceTest/VoiceTestScreen";
import { colors } from "../theme/tokens";
import { PracticeNavigator } from "./PracticeNavigator";
import { SimulationNavigator } from "./SimulationNavigator";
import { SocialNavigator } from "./SocialNavigator";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
export type AppTabParamList = {
  Home: undefined;
  VoiceTest: undefined;
  Practice: undefined;
  Results: undefined;
  Social: undefined;
  // Hidden screens (accessible via ProfileMenu)
  Profile: undefined;
  Analytics: undefined;
  Settings: undefined;
  Subscription: undefined;
  Usage: undefined;
  Simulations: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

const SplashScreen = () => (
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

const TabIcon = ({
  label,
  color,
  focused,
}: {
  label: string;
  color: string;
  focused: boolean;
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    <Text style={{ fontSize: focused ? 22 : 20, color }}>{label}</Text>
  </View>
);

const AppTabs = () => (
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
    <Tab.Screen name="Home" component={HomeScreen} />
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
      options={{
        tabBarButton: () => null, // Hide from tab bar
      }}
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
  </Tab.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

export const AppNavigator = () => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer theme={DefaultTheme}>
      {user ? <AppTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = RNStyleSheet.create({
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
