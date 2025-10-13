import { createStackNavigator } from "@react-navigation/stack";
import React from "react";

// Screens
import { AchievementsScreen } from "../screens/Social/AchievementsScreen";
import { ChatScreen } from "../screens/Social/ChatScreen";
import { ConversationsScreen } from "../screens/Social/ConversationsScreen";
import { FriendsListScreen } from "../screens/Social/FriendsListScreen";
import { LeaderboardScreen } from "../screens/Social/LeaderboardScreen";
import { ReferralsScreen } from "../screens/Social/ReferralsScreen";
import { SocialHomeScreen } from "../screens/Social/SocialHomeScreen";

// TODO: Import remaining screens as you create them
// import { FriendRequestsScreen } from '../screens/Social/FriendRequestsScreen';
// import { FindFriendsScreen } from '../screens/Social/FindFriendsScreen';
// import { UserProfileScreen } from '../screens/Social/UserProfileScreen';
// import { StudyGroupsScreen } from '../screens/Social/StudyGroupsScreen';
// import { GroupDetailScreen } from '../screens/Social/GroupDetailScreen';
// import { CreateGroupScreen } from '../screens/Social/CreateGroupScreen';
// import { QRCodeScreen } from '../screens/Social/QRCodeScreen';
// import { QRCodeScannerScreen } from '../screens/Social/QRCodeScannerScreen';
// import { EditProfileScreen } from '../screens/Social/EditProfileScreen';
// import { PrivacySettingsScreen } from '../screens/Social/PrivacySettingsScreen';

export type SocialStackParamList = {
  SocialHome: undefined;
  FriendsList: undefined;
  FriendRequests: undefined;
  FindFriends: undefined;
  UserProfile: { userId: string };
  Conversations: undefined;
  Chat: {
    conversationId?: string;
    recipientId?: string;
    recipientName?: string;
    isGroupChat?: boolean;
  };
  StudyGroups: undefined;
  GroupDetail: { groupId: string };
  CreateGroup: undefined;
  GroupChat: { groupId: string; groupName: string };
  Leaderboard: undefined;
  Achievements: undefined;
  AchievementDetail: { achievementId: string };
  Referrals: undefined;
  QRCode: undefined;
  QRCodeScanner: undefined;
  Settings: undefined;
  PrivacySettings: undefined;
  EditProfile: undefined;
};

const Stack = createStackNavigator<SocialStackParamList>();

export const SocialNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FFFFFF",
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: "#007AFF",
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: "600",
        },
      }}
    >
      <Stack.Screen
        name="SocialHome"
        component={SocialHomeScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="FriendsList"
        component={FriendsListScreen}
        options={{
          title: "Friends",
        }}
      />

      {/* Placeholder for FriendRequests - uncomment when created
      <Stack.Screen
        name="FriendRequests"
        component={FriendRequestsScreen}
        options={{
          title: 'Friend Requests',
        }}
      />
      */}

      {/* Placeholder for FindFriends - uncomment when created
      <Stack.Screen
        name="FindFriends"
        component={FindFriendsScreen}
        options={{
          title: 'Find Friends',
        }}
      />
      */}

      {/* Placeholder for UserProfile - uncomment when created
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
      */}

      <Stack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params?.recipientName || "Chat",
        })}
      />

      {/* Placeholder for StudyGroups - uncomment when created
      <Stack.Screen
        name="StudyGroups"
        component={StudyGroupsScreen}
        options={{
          title: 'Study Groups',
        }}
      />
      */}

      {/* Placeholder for GroupDetail - uncomment when created
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{
          title: 'Group Details',
        }}
      />
      */}

      {/* Placeholder for CreateGroup - uncomment when created
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{
          title: 'Create Group',
        }}
      />
      */}

      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          title: "Leaderboard",
        }}
      />

      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{
          title: "Achievements",
        }}
      />

      {/* Placeholder for AchievementDetail - uncomment when created
      <Stack.Screen
        name="AchievementDetail"
        component={AchievementDetailScreen}
        options={{
          title: 'Achievement',
        }}
      />
      */}

      <Stack.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{
          title: "Refer Friends",
        }}
      />

      {/* Placeholder for QRCode - uncomment when created
      <Stack.Screen
        name="QRCode"
        component={QRCodeScreen}
        options={{
          title: 'Your QR Code',
        }}
      />
      */}

      {/* Placeholder for QRCodeScanner - uncomment when created
      <Stack.Screen
        name="QRCodeScanner"
        component={QRCodeScannerScreen}
        options={{
          title: 'Scan QR Code',
          headerShown: false,
        }}
      />
      */}

      {/* Placeholder for EditProfile - uncomment when created
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: 'Edit Profile',
        }}
      />
      */}

      {/* Placeholder for PrivacySettings - uncomment when created
      <Stack.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{
          title: 'Privacy Settings',
        }}
      />
      */}
    </Stack.Navigator>
  );
};
