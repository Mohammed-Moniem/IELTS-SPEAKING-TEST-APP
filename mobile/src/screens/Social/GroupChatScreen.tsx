import { RouteProp, useRoute } from "@react-navigation/native";
import React from "react";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";
import { ChatScreen } from "./ChatScreen";

type GroupChatScreenRouteProp = RouteProp<SocialStackParamList, "GroupChat">;

export const GroupChatScreen: React.FC = () => {
  const route = useRoute<GroupChatScreenRouteProp>();
  const { groupId, groupName } = route.params;

  // Reuse ChatScreen component with group chat mode
  return <ChatScreen />;
};
