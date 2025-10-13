import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { PracticeResultDetailScreen } from "../screens/Practice/PracticeResultDetailScreen";
import { PracticeScreen } from "../screens/Practice/PracticeScreen";
import { PracticeSessionScreen } from "../screens/Practice/PracticeSessionScreen";
import { PracticeSessionStart } from "../types/api";

export type PracticeStackParamList = {
  PracticeHome: undefined;
  PracticeSession: { session: PracticeSessionStart };
  PracticeResultDetail: { sessionId: string };
};

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export const PracticeNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShadowVisible: false, // Remove header shadow/border
    }}
  >
    <Stack.Screen
      name="PracticeHome"
      component={PracticeScreen}
      options={{ title: "Practice" }}
    />
    <Stack.Screen
      name="PracticeSession"
      component={PracticeSessionScreen}
      options={{ title: "Practice session" }}
    />
    <Stack.Screen
      name="PracticeResultDetail"
      component={PracticeResultDetailScreen}
      options={{ title: "Session details" }}
    />
  </Stack.Navigator>
);
