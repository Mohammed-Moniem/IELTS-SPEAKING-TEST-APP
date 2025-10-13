import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

type AchievementDetailScreenRouteProp = RouteProp<
  SocialStackParamList,
  "AchievementDetail"
>;

export const AchievementDetailScreen: React.FC = () => {
  const route = useRoute<AchievementDetailScreenRouteProp>();
  const { achievementId } = route.params;

  // Mock achievement data - in real app, fetch from API
  const achievement = {
    icon: "🎯",
    name: "First Steps",
    description: "Complete your first practice session",
    points: 50,
    category: "PRACTICE",
    progress: 100,
    requirement: 1,
    isUnlocked: true,
    unlockedAt: new Date().toISOString(),
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{achievement.icon}</Text>
        <Text style={styles.name}>{achievement.name}</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>+{achievement.points} XP</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{achievement.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${achievement.progress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {achievement.progress}% Complete
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Requirement</Text>
        <Text style={styles.requirement}>
          {achievement.requirement} {achievement.category.toLowerCase()}{" "}
          session(s)
        </Text>
      </View>

      {achievement.isUnlocked && (
        <View style={styles.unlockedSection}>
          <Ionicons name="checkmark-circle" size={48} color="#34C759" />
          <Text style={styles.unlockedTitle}>Achievement Unlocked!</Text>
          <Text style={styles.unlockedDate}>
            {new Date(achievement.unlockedAt).toLocaleDateString()}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    padding: 32,
  },
  icon: {
    fontSize: 80,
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
    textAlign: "center",
  },
  pointsBadge: {
    backgroundColor: "#5856D6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pointsText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  section: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
  },
  description: {
    fontSize: 17,
    color: "#8E8E93",
    lineHeight: 24,
  },
  progressContainer: {
    gap: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#34C759",
  },
  progressText: {
    fontSize: 15,
    color: "#8E8E93",
  },
  requirement: {
    fontSize: 17,
    color: "#000000",
  },
  unlockedSection: {
    alignItems: "center",
    padding: 32,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
  },
  unlockedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#34C759",
    marginTop: 16,
  },
  unlockedDate: {
    fontSize: 15,
    color: "#8E8E93",
    marginTop: 8,
  },
});
