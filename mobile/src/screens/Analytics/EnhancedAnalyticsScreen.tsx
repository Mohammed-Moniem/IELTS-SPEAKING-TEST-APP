/**
 * Enhanced Analytics Screen
 * Comprehensive progress tracking with charts and visualizations
 */

import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { practiceApi, simulationApi } from "../../api/services";
import {
  BandDistributionChart,
  CategoryPerformanceChart,
  ScoreLineChart,
  TimeOfDayChart,
} from "../../components/charts/ChartComponents";
import analyticsService from "../../services/analyticsService";

type TimePeriod = "week" | "month" | "all";

export const EnhancedAnalyticsScreen: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("month");

  // Fetch practice sessions
  const { data: practices = [], isLoading: practicesLoading } = useQuery({
    queryKey: ["practice-sessions"],
    queryFn: () => practiceApi.listSessions({ limit: 100 }),
  });

  // Fetch simulations
  const { data: simulations = [], isLoading: simulationsLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => simulationApi.list({ limit: 100 }),
  });

  const isLoading = practicesLoading || simulationsLoading;

  // Calculate analytics
  const progressStats = analyticsService.calculateProgressStats(
    practices,
    simulations
  );
  const scoreDataPoints = analyticsService.getScoreDataPoints(
    practices,
    simulations
  );
  const scoreTrend = analyticsService.calculateScoreTrend(
    scoreDataPoints,
    selectedPeriod
  );
  const categoryPerformance =
    analyticsService.calculateCategoryPerformance(practices);
  const timeOfDayStats = analyticsService.calculateTimeOfDayStats(
    practices,
    simulations
  );
  const bandDistribution = analyticsService.calculateBandDistribution(
    practices,
    simulations
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (practices.length === 0 && simulations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="bar-chart-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Data Yet</Text>
          <Text style={styles.emptyText}>
            Complete practice sessions to see your progress analytics
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>
          Track your progress and identify areas for improvement
        </Text>
      </View>

      {/* Key Statistics Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{progressStats.averageScore}</Text>
          <Text style={styles.statLabel}>Average Score</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#10B981" />
          <Text style={styles.statValue}>{progressStats.totalSessions}</Text>
          <Text style={styles.statLabel}>Total Sessions</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="flame" size={24} color="#EF4444" />
          <Text style={styles.statValue}>{progressStats.currentStreak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="stats-chart" size={24} color="#6366F1" />
          <Text style={styles.statValue}>
            {progressStats.improvementRate > 0 ? "+" : ""}
            {progressStats.improvementRate}%
          </Text>
          <Text style={styles.statLabel}>Improvement</Text>
        </View>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === "week" && styles.periodButtonActive,
          ]}
          onPress={() => setSelectedPeriod("week")}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === "week" && styles.periodButtonTextActive,
            ]}
          >
            Week
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === "month" && styles.periodButtonActive,
          ]}
          onPress={() => setSelectedPeriod("month")}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === "month" && styles.periodButtonTextActive,
            ]}
          >
            Month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === "all" && styles.periodButtonActive,
          ]}
          onPress={() => setSelectedPeriod("all")}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === "all" && styles.periodButtonTextActive,
            ]}
          >
            All Time
          </Text>
        </TouchableOpacity>
      </View>

      {/* Score Trend Chart */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Score Trend</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>
              {scoreTrend.improvement > 0 ? "+" : ""}
              {scoreTrend.improvement}%
            </Text>
          </View>
        </View>
        <ScoreLineChart data={scoreTrend.dataPoints} />
      </View>

      {/* Category Performance */}
      {categoryPerformance.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance by Part</Text>
          <CategoryPerformanceChart data={categoryPerformance} />

          {/* Category Details */}
          <View style={styles.categoryDetails}>
            {categoryPerformance.map((cat) => (
              <View key={cat.category} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{cat.category}</Text>
                  <Text style={styles.categoryCount}>
                    {cat.sessionCount} session
                    {cat.sessionCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.categoryScores}>
                  <Text style={styles.categoryScore}>{cat.averageScore}</Text>
                  <View
                    style={[
                      styles.trendIndicator,
                      {
                        backgroundColor:
                          cat.trend === "improving"
                            ? "#D1FAE5"
                            : cat.trend === "declining"
                            ? "#FEE2E2"
                            : "#F3F4F6",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        cat.trend === "improving"
                          ? "trending-up"
                          : cat.trend === "declining"
                          ? "trending-down"
                          : "remove"
                      }
                      size={14}
                      color={
                        cat.trend === "improving"
                          ? "#10B981"
                          : cat.trend === "declining"
                          ? "#EF4444"
                          : "#6B7280"
                      }
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Band Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Band Score Distribution</Text>
        <BandDistributionChart data={bandDistribution} />
      </View>

      {/* Time of Day Performance */}
      {timeOfDayStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Best Time to Practice</Text>
          <Text style={styles.sectionSubtitle}>
            Sessions and performance by hour
          </Text>
          <TimeOfDayChart data={timeOfDayStats} />
        </View>
      )}

      {/* Additional Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Insights</Text>
        <View style={styles.insightCard}>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Highest Score</Text>
            <Text style={styles.insightValue}>
              {progressStats.highestScore}
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Lowest Score</Text>
            <Text style={styles.insightValue}>{progressStats.lowestScore}</Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Longest Streak</Text>
            <Text style={styles.insightValue}>
              {progressStats.longestStreak} days
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Total Practice Time</Text>
            <Text style={styles.insightValue}>
              {Math.round(
                practices.reduce((sum, p) => sum + (p.timeSpent || 0), 0) / 60
              )}{" "}
              mins
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  header: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  periodSelector: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  periodButtonTextActive: {
    color: "#FFFFFF",
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 12,
  },
  sectionBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
  },
  categoryDetails: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  categoryCount: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  categoryScores: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryScore: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  trendIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 12,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  insightLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  insightValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
});
