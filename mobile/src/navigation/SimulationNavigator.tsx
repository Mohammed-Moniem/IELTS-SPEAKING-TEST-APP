import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { SimulationDetailScreen } from "../screens/Simulation/SimulationDetailScreen";
import { SimulationListScreen } from "../screens/Simulation/SimulationListScreen";
import { SimulationSessionScreen } from "../screens/Simulation/SimulationSessionScreen";
import { SimulationVoiceSessionScreen } from "../screens/Simulation/SimulationVoiceSessionScreen";
import { TestSimulation } from "../types/api";

export type SimulationStackParamList = {
  SimulationList: undefined;
  SimulationSession: {
    simulationId: string;
    parts: Array<{
      part: number;
      question: string;
      topicTitle?: string;
      timeLimit?: number;
      tips?: string[];
    }>;
  };
  SimulationVoiceSession: {
    simulationId: string;
    parts: Array<{
      part: number;
      question: string;
      topicTitle?: string;
      timeLimit?: number;
      tips?: string[];
    }>;
  };
  SimulationDetail: { simulation: TestSimulation };
};

const Stack = createNativeStackNavigator<SimulationStackParamList>();

export const SimulationNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShadowVisible: false, // Remove header shadow/border
    }}
  >
    <Stack.Screen
      name="SimulationList"
      component={SimulationListScreen}
      options={{ title: "Test simulations" }}
    />
    <Stack.Screen
      name="SimulationSession"
      component={SimulationSessionScreen}
      options={{ title: "Simulation in progress" }}
    />
    <Stack.Screen
      name="SimulationVoiceSession"
      component={SimulationVoiceSessionScreen}
      options={{ title: "Voice simulation" }}
    />
    <Stack.Screen
      name="SimulationDetail"
      component={SimulationDetailScreen}
      options={{ title: "Simulation feedback" }}
    />
  </Stack.Navigator>
);
