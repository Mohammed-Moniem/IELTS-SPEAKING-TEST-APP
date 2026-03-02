/**
 * Dashboard Screen - Main Navigation Hub
 * Provides access to all app features: Practice, Simulation, Recordings, Progress, History
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
}

interface FeatureCard {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  colors: [string, string];
  screen: string;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigate,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const headerGradientColors = [colors.primaryStrong, colors.primary] as const;

  const features: FeatureCard[] = [
    {
      id: "practice",
      title: "Practice Mode",
      subtitle: "Improve your speaking skills",
      icon: "school",
      colors: [colors.primary, colors.primaryStrong],
      screen: "VoiceTest",
    },
    {
      id: "simulation",
      title: "Full Test Simulation",
      subtitle: "Complete 3-part IELTS test",
      icon: "trophy",
      colors: [colors.warning, colors.warning],
      screen: "Simulation",
    },
    {
      id: "recordings",
      title: "My Recordings",
      subtitle: "Listen to past recordings",
      icon: "musical-notes",
      colors: [colors.info, colors.primary],
      screen: "MyRecordings",
    },
    {
      id: "progress",
      title: "Progress Dashboard",
      subtitle: "Track your improvement",
      icon: "analytics",
      colors: [colors.success, colors.success],
      screen: "ProgressDashboard",
    },
    {
      id: "history",
      title: "Test History",
      subtitle: "Review all past tests",
      icon: "document-text",
      colors: [colors.warning, colors.primaryStrong],
      screen: "TestHistory",
    },
  ];

  const renderFeatureCard = (feature: FeatureCard) => (
    <TouchableOpacity
      key={feature.id}
      onPress={() => onNavigate(feature.screen)}
      activeOpacity={0.8}
      style={styles.cardContainer}
    >
      <LinearGradient colors={feature.colors} style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name={feature.icon} size={32} color={colors.primaryOn} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{feature.title}</Text>
          <Text style={styles.cardSubtitle}>{feature.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.primaryOn} />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={headerGradientColors} style={styles.header}>
        <Text style={styles.headerTitle}>IELTS Speaking Test</Text>
        <Text style={styles.headerSubtitle}>
          Your AI-Powered Practice Partner
        </Text>
      </LinearGradient>

      {/* Feature Cards */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Welcome Back!</Text>
          <Text style={styles.statsSubtitle}>
            Continue your journey to IELTS success
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="trophy-outline" size={24} color={colors.warning} />
              <Text style={styles.statLabel}>Track Progress</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="mic-outline" size={24} color={colors.primary} />
              <Text style={styles.statLabel}>Voice AI</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="analytics-outline" size={24} color={colors.success} />
              <Text style={styles.statLabel}>Real Feedback</Text>
            </View>
          </View>
        </View>

        {/* Feature Cards */}
        <View style={styles.featuresContainer}>
          <Text style={styles.sectionTitle}>Features</Text>
          {features.map(renderFeatureCard)}
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoTitle}>How It Works</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>1.</Text>
            <Text style={styles.infoText}>
              Choose Practice Mode for quick sessions or Full Simulation for
              complete tests
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>2.</Text>
            <Text style={styles.infoText}>
              Speak naturally - AI will evaluate your fluency, vocabulary,
              grammar, and pronunciation
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>3.</Text>
            <Text style={styles.infoText}>
              Get detailed feedback with band scores and improvement suggestions
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>4.</Text>
            <Text style={styles.infoText}>
              Track your progress over time in the Progress Dashboard
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 60,
      paddingBottom: 30,
      paddingHorizontal: 20,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.primaryOn,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.warning,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      marginBottom: 30,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    statsTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    statsSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 20,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statItem: {
      alignItems: "center",
      gap: 8,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    featuresContainer: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    cardContainer: {
      marginBottom: 12,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderRadius: 16,
      gap: 15,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.primaryOn,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 13,
      color: colors.primaryOn,
      opacity: 0.8,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    infoHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 15,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    infoItem: {
      flexDirection: "row",
      marginBottom: 12,
      gap: 10,
    },
    infoBullet: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
      width: 20,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    bottomSpacing: {
      height: 40,
    },
  });
