import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect } from "react";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

type GroupChatScreenRouteProp = RouteProp<SocialStackParamList, "GroupChat">;

/**
 * GroupChatScreen - Wrapper for group chat functionality
 * Redirects to ChatScreen with group chat parameters
 */
export const GroupChatScreen: React.FC = () => {
  const route = useRoute<GroupChatScreenRouteProp>();
  const navigation = useNavigation<any>();
  const { groupId, groupName } = route.params;

  useEffect(() => {
    // Replace this screen with ChatScreen passing group parameters
    navigation.replace("Chat", {
      recipientId: groupId,
      recipientName: groupName,
      isGroupChat: true,
    });
  }, [groupId, groupName, navigation]);

  // Show loading while redirecting
  return null;
};
