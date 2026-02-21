/**
 * Progress Dashboard Screen
 * Displays comprehensive analytics: band scores, trends, criteria breakdown
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import {
  BandDistribution,
  compareCriteriaPerformance,
  CriteriaComparison,
  getBandDistribution,
  getProgressStats,
  ProgressStats,
} from "../../api/analyticsApi";

const SCREEN_WIDTH = Dimensions.get("window").width;

export const ProgressDashboardScreen: React.FC = () => {
  const { user, initializing: authInitializing } = useAuth();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [distribution, setDistribution] = useState<BandDistribution[]>([]);
  const [comparison, setComparison] = useState<CriteriaComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 90 | 365>(30);
  const userId = user?._id ?? null;

  useEffect(() => {
    if (authInitializing) {
      return;
    }

    if (!userId) {
      setStats(null);
      setDistribution([]);
      setComparison([]);
      setLoading(false);
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, userId, authInitializing]);

  const loadData = async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);

      const [statsData, distData, compData] = await Promise.all([
        getProgressStats(userId, {
          daysBack: selectedPeriod,
          includeTests: 10,
        }),
        getBandDistribution(userId),
        compareCriteriaPerformance(userId, selectedPeriod),
      ]);

      setStats(statsData);
      setDistribution(distData);
      setComparison(compData);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId) {
      return;
    }
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getBandColor = (band: number): string => {
    if (band >= 8) return "#10b981";
    if (band >= 7) return "#3b82f6";
    if (band >= 6) return "#f59e0b";
    return "#ef4444";
  };

  const getTrendIcon = (trend: "improving" | "declining" | "stable") => {
    if (trend === "improving") return "trending-up" as const;
    if (trend === "declining") return "trending-down" as const;
    return "remove" as const;
  };

  const getTrendColor = (trend: "up" | "down" | "stable"): string => {
    if (trend === "up") return "#10b981";
    if (trend === "down") return "#ef4444";
    return "#9ca3af";
  };

  const renderOverallScoreCard = () => {
    if (!stats) return null;

    return (
      <LinearGradient
        colors={["#1a365d", "#2d5a8f"]}
        style={styles.overallCard}
      >
        <View style={styles.overallHeader}>
          <Text style={styles.overallLabel}>Overall Band Score</Text>
          <View style={styles.trendBadge}>
            <Ionicons
              name={getTrendIcon(stats.bandTrend)}
              size={16}
              color="#ffffff"
            />
            <Text style={styles.trendText}>
              {stats.bandTrend === "improving"
                ? "Improving"
                : stats.bandTrend === "declining"
                ? "Declining"
                : "Stable"}
            </Text>
          </View>
        </View>

        <View style={styles.overallScoreContainer}>
          <Text style={styles.overallScore}>
            {stats.averageBand.toFixed(1)}
          </Text>
          <View style={styles.rangeContainer}>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Highest</Text>
              <Text style={styles.rangeValue}>
                {stats.highestBand.toFixed(1)}
              </Text>
            </View>
            <View style={styles.rangeDivider} />
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Lowest</Text>
              <Text style={styles.rangeValue}>
                {stats.lowestBand.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.testCountRow}>
          <View style={styles.testCountItem}>
            <Text style={styles.testCountValue}>{stats.totalTests}</Text>
            <Text style={styles.testCountLabel}>Total Tests</Text>
          </View>
          <View style={styles.testCountItem}>
            <Text style={styles.testCountValue}>{stats.practiceTests}</Text>
            <Text style={styles.testCountLabel}>Practice</Text>
          </View>
          <View style={styles.testCountItem}>
            <Text style={styles.testCountValue}>{stats.simulationTests}</Text>
            <Text style={styles.testCountLabel}>Simulation</Text>
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderCriteriaAverages = () => {
    if (!stats) return null;

    const criteria = [
      {
        name: "Fluency & Coherence",
        key: "fluencyCoherence",
        icon: "chatbubbles",
      },
      { name: "Lexical Resource", key: "lexicalResource", icon: "book" },
      {
        name: "Grammatical Range",
        key: "grammaticalRange",
        icon: "code-working",
      },
      { name: "Pronunciation", key: "pronunciation", icon: "mic" },
    ];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Criteria Breakdown</Text>
        {criteria.map((criterion) => {
          const score =
            stats.criteriaAverages[
              criterion.key as keyof typeof stats.criteriaAverages
            ];
          const criterionComparison = comparison.find(
            (c) => c.criterion === criterion.name
          );

          return (
            <View key={criterion.key} style={styles.criteriaCard}>
              <View style={styles.criteriaHeader}>
                <View style={styles.criteriaLeft}>
                  <Ionicons
                    name={criterion.icon as any}
                    size={20}
                    color="#3b82f6"
                  />
                  <Text style={styles.criteriaName}>{criterion.name}</Text>
                </View>
                <View style={styles.criteriaRight}>
                  {criterionComparison && (
                    <View style={styles.changeIndicator}>
                      <Ionicons
                        name={
                          criterionComparison.trend === "up"
                            ? "arrow-up"
                            : criterionComparison.trend === "down"
                            ? "arrow-down"
                            : "remove"
                        }
                        size={14}
                        color={getTrendColor(criterionComparison.trend)}
                      />
                      <Text
                        style={[
                          styles.changeText,
                          { color: getTrendColor(criterionComparison.trend) },
                        ]}
                      >
                        {Math.abs(criterionComparison.change).toFixed(1)}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.criteriaScore,
                      { color: getBandColor(score) },
                    ]}
                  >
                    {score.toFixed(1)}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(score / 9) * 100}%`,
                      backgroundColor: getBandColor(score),
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderStrengthsWeaknesses = () => {
    if (!stats) return null;

    return (
      <View style={styles.section}>
        <View style={styles.strengthsWeaknessesContainer}>
          {/* Strengths */}
          <View style={styles.strengthsCard}>
            <View style={styles.swHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.swTitle}>Strengths</Text>
            </View>
            {stats.strengths.map((strength, index) => (
              <View key={index} style={styles.swItem}>
                <View style={styles.swDot} />
                <Text style={styles.swText}>{strength}</Text>
              </View>
            ))}
          </View>

          {/* Weaknesses */}
          <View style={styles.weaknessesCard}>
            <View style={styles.swHeader}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.swTitle}>Focus Areas</Text>
            </View>
            {stats.weaknesses.map((weakness, index) => (
              <View key={index} style={styles.swItem}>
                <View style={styles.swDot} />
                <Text style={styles.swText}>{weakness}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderBandDistribution = () => {
    if (distribution.length === 0) return null;

    const maxCount = Math.max(...distribution.map((d) => d.count));

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Band Distribution</Text>
        <View style={styles.distributionContainer}>
          {distribution.map((item) => (
            <View key={item.band} style={styles.distributionItem}>
              <Text style={styles.distributionBand}>{item.band}</Text>
              <View style={styles.distributionBarContainer}>
                <View
                  style={[
                    styles.distributionBar,
                    {
                      height: `${(item.count / maxCount) * 100}%`,
                      backgroundColor: getBandColor(item.band),
                    },
                  ]}
                />
              </View>
              <Text style={styles.distributionPercentage}>
                {item.percentage}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMonthlyProgress = () => {
    if (!stats || stats.monthlyProgress.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Progress</Text>
        {stats.monthlyProgress.map((month) => (
          <View key={month.month} style={styles.monthCard}>
            <View style={styles.monthHeader}>
              <Text style={styles.monthLabel}>
                {new Date(month.month + "-01").toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Text
                style={[
                  styles.monthScore,
                  { color: getBandColor(month.averageBand) },
                ]}
              >
                {month.averageBand.toFixed(1)}
              </Text>
            </View>
            <View style={styles.monthStats}>
              <Text style={styles.monthStat}>
                {month.testCount} test{month.testCount !== 1 ? "s" : ""}
              </Text>
              <Text style={styles.monthStat}>•</Text>
              <Text style={styles.monthStat}>
                {month.practiceCount} practice
              </Text>
              <Text style={styles.monthStat}>•</Text>
              <Text style={styles.monthStat}>
                {month.simulationCount} simulation
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (authInitializing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
          <Text style={styles.headerTitle}>Progress Dashboard</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
          <Text style={styles.headerTitle}>Progress Dashboard</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptySubtitle}>
            Log in or create an account to unlock your personalized analytics
          </Text>
        </View>
      </View>
    );
  }

  if (loading && !stats) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
          <Text style={styles.headerTitle}>Progress Dashboard</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
          <Text style={styles.headerTitle}>Progress Dashboard</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <Ionicons name="analytics-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyTitle}>No Data Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete some tests to see your progress
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
        <Text style={styles.headerTitle}>Progress Dashboard</Text>

        {/* Period selector */}
        <View style={styles.periodSelector}>
          {[30, 90, 365].map((days) => (
            <TouchableOpacity
              key={days}
              style={[
                styles.periodButton,
                selectedPeriod === days && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(days as any)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === days && styles.periodButtonTextActive,
                ]}
              >
                {days === 30 ? "30D" : days === 90 ? "90D" : "1Y"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        {renderOverallScoreCard()}
        {renderCriteriaAverages()}
        {renderStrengthsWeaknesses()}
        {renderBandDistribution()}
        {renderMonthlyProgress()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 15,
  },
  periodSelector: {
    flexDirection: "row",
    gap: 10,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  periodButtonActive: {
    backgroundColor: "#ffffff",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  periodButtonTextActive: {
    color: "#1a365d",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  overallCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  overallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  overallLabel: {
    fontSize: 14,
    color: "#d4a745",
    fontWeight: "600",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  overallScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 20,
  },
  overallScore: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#ffffff",
  },
  rangeContainer: {
    flex: 1,
  },
  rangeItem: {
    marginBottom: 10,
  },
  rangeLabel: {
    fontSize: 12,
    color: "#d1d5db",
    marginBottom: 2,
  },
  rangeValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  rangeDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginVertical: 5,
  },
  testCountRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    paddingTop: 15,
  },
  testCountItem: {
    flex: 1,
    alignItems: "center",
  },
  testCountValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 5,
  },
  testCountLabel: {
    fontSize: 12,
    color: "#d1d5db",
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 15,
  },
  criteriaCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  criteriaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  criteriaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  criteriaName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    flex: 1,
  },
  criteriaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  changeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  changeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  criteriaScore: {
    fontSize: 18,
    fontWeight: "bold",
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#2d2d2d",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  strengthsWeaknessesContainer: {
    flexDirection: "row",
    gap: 12,
  },
  strengthsCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
  },
  weaknessesCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  swHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  swTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  swItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  swDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9ca3af",
    marginTop: 6,
  },
  swText: {
    flex: 1,
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 18,
  },
  distributionContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    gap: 8,
  },
  distributionItem: {
    flex: 1,
    alignItems: "center",
  },
  distributionBand: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  distributionBarContainer: {
    height: 100,
    width: "100%",
    backgroundColor: "#2d2d2d",
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  distributionBar: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  distributionPercentage: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 8,
  },
  monthCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  monthScore: {
    fontSize: 20,
    fontWeight: "bold",
  },
  monthStats: {
    flexDirection: "row",
    gap: 8,
  },
  monthStat: {
    fontSize: 12,
    color: "#9ca3af",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#9ca3af",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
});
