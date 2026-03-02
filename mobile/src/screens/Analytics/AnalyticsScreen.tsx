import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { getBandDistribution, getProgressStats } from "../../api/analyticsApi";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

const { width: screenWidth } = Dimensions.get("window");

type TimePeriod = "7" | "30" | "90" | "all";

export const AnalyticsScreen = () => {
  const { user, initializing: authInitializing } = useAuth();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const userId = user?._id ?? null;
  const renderCriteriaBar = (label: string, score: number) => {
    const percentage = (score / 9) * 100;
    return (
      <View key={label} style={styles.criteriaRow}>
        <Text style={styles.criteriaLabel}>{label}</Text>
        <View style={styles.criteriaBarContainer}>
          <View
            style={[
              styles.criteriaBarFill,
              {
                width: `${percentage}%`,
                backgroundColor: getBandColor(score, colors),
              },
            ]}
          />
        </View>
        <Text style={styles.criteriaScore}>{score.toFixed(1)}</Text>
      </View>
    );
  };

  const daysBack = timePeriod === "all" ? undefined : parseInt(timePeriod, 10);

  const progressQuery = useQuery({
    queryKey: ["progress-stats", userId, daysBack],
    queryFn: () => getProgressStats(userId!, { daysBack }),
    enabled: Boolean(userId),
  });

  const bandDistQuery = useQuery({
    queryKey: ["band-distribution", userId],
    queryFn: () => getBandDistribution(userId!),
    enabled: Boolean(userId),
  });

  if (authInitializing) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!userId) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to view analytics</Text>
          <Text style={styles.emptyText}>
            Log in to sync your IELTS progress and unlock insights
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (progressQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const stats = progressQuery.data;
  const bandDist = bandDistQuery.data || [];

  if (!stats) {
    return (
      <ScreenContainer>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="analytics-outline"
            size={64}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyText}>
            Complete some tests to see your progress analytics
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable>
      <SectionHeading title="Progress Analytics">
        Track your IELTS speaking improvement
      </SectionHeading>

      {/* Time Period Selector */}
      <View style={styles.periodSelector}>
        {(["7", "30", "90", "all"] as TimePeriod[]).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              timePeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => setTimePeriod(period)}
            accessibilityRole="button"
            accessibilityState={{ selected: timePeriod === period }}
            accessibilityLabel={
              period === "all" ? "Select all-time analytics" : `Select ${period} day analytics`
            }
            accessibilityHint="Update analytics to this time period"
          >
            <Text
              style={[
                styles.periodButtonText,
                timePeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {period === "all" ? "All time" : `${period} days`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Stats */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalTests}</Text>
          <Text style={styles.statLabel}>Total Tests</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text
            style={[
              styles.statValue,
              { color: getBandColor(stats.averageBand, colors) },
            ]}
          >
            {stats.averageBand.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Avg Band</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {stats.highestBand.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Highest</Text>
        </Card>
        <Card style={styles.statCard}>
          <View style={styles.trendBadge}>
            <Ionicons
              name={
                stats.bandTrend === "improving"
                  ? "trending-up"
                  : stats.bandTrend === "declining"
                  ? "trending-down"
                  : "remove"
              }
              size={20}
              color={
                stats.bandTrend === "improving"
                  ? colors.success
                  : stats.bandTrend === "declining"
                  ? colors.danger
                  : colors.textMuted
              }
            />
          </View>
          <Text style={styles.statLabel}>
            {capitalizeFirst(stats.bandTrend)}
          </Text>
        </Card>
      </View>

      {/* Band Score Chart */}
      <SectionHeading title="Band Score Distribution" />
      <Card>
        <View style={styles.chartContainer}>
          {bandDist.length > 0 ? (
            bandDist.map((item) => (
              <View key={item.band} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${item.percentage}%`,
                      backgroundColor: getBandColor(item.band, colors),
                    },
                  ]}
                >
                  <Text style={styles.barLabel}>{item.count}</Text>
                </View>
                <Text style={styles.barAxisLabel}>{item.band.toFixed(1)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No data available</Text>
          )}
        </View>
      </Card>

      {/* Criteria Performance */}
      <SectionHeading title="Performance by Criteria" />
      <Card>
        {renderCriteriaBar(
          "Fluency & Coherence",
          stats.criteriaAverages.fluencyCoherence
        )}
        {renderCriteriaBar(
          "Lexical Resource",
          stats.criteriaAverages.lexicalResource
        )}
        {renderCriteriaBar(
          "Grammatical Range",
          stats.criteriaAverages.grammaticalRange
        )}
        {renderCriteriaBar(
          "Pronunciation",
          stats.criteriaAverages.pronunciation
        )}
      </Card>

      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvanced }}
        accessibilityLabel={showAdvanced ? "Hide analytics details" : "Show analytics details"}
        accessibilityHint="Toggle advanced analytics breakdown"
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? "Hide details" : "See details"}
        </Text>
        <Ionicons
          name={showAdvanced ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.primary}
        />
      </TouchableOpacity>

      {showAdvanced && (
        <>
          {/* Monthly Progress */}
          {stats.monthlyProgress && stats.monthlyProgress.length > 0 && (
            <>
              <SectionHeading title="Monthly Progress" />
              <Card>
                <View style={styles.monthlyChart}>
                  {stats.monthlyProgress.map((month) => (
                    <View key={month.month} style={styles.monthColumn}>
                      <View style={styles.monthBar}>
                        <View
                          style={[
                            styles.monthBarFill,
                            {
                              height: `${(month.averageBand / 9) * 100}%`,
                              backgroundColor: getBandColor(month.averageBand, colors),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.monthScore}>
                        {month.averageBand.toFixed(1)}
                      </Text>
                      <Text style={styles.monthLabel} numberOfLines={1}>
                        {month.month}
                      </Text>
                      <Text style={styles.monthTests}>{month.testCount} tests</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          )}

          {/* Strengths & Weaknesses */}
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <SectionHeading title="Strengths" />
              <Card>
                {stats.strengths.length > 0 ? (
                  stats.strengths.map((strength, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={colors.success}
                      />
                      <Text style={styles.listItemText}>{strength}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noDataText}>
                    Keep practicing to discover strengths
                  </Text>
                )}
              </Card>
            </View>

            <View style={styles.column}>
              <SectionHeading title="Areas to Improve" />
              <Card>
                {stats.weaknesses.length > 0 ? (
                  stats.weaknesses.map((weakness, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Ionicons
                        name="alert-circle"
                        size={18}
                        color={colors.warning}
                      />
                      <Text style={styles.listItemText}>{weakness}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noDataText}>
                    Doing great! No major weaknesses
                  </Text>
                )}
              </Card>
            </View>
          </View>

          {/* Test Type Breakdown */}
          <SectionHeading title="Test Type Breakdown" />
          <Card>
            <View style={styles.breakdown}>
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownIcon}>
                  <Ionicons name="book" size={24} color={colors.primary} />
                </View>
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownValue}>{stats.practiceTests}</Text>
                  <Text style={styles.breakdownLabel}>Practice Sessions</Text>
                </View>
                <Text style={styles.breakdownPercentage}>
                  {((stats.practiceTests / stats.totalTests) * 100).toFixed(0)}%
                </Text>
              </View>

              <View style={styles.breakdownItem}>
                <View style={styles.breakdownIcon}>
                  <Ionicons name="trophy" size={24} color={colors.warning} />
                </View>
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownValue}>
                    {stats.simulationTests}
                  </Text>
                  <Text style={styles.breakdownLabel}>Full Simulations</Text>
                </View>
                <Text style={styles.breakdownPercentage}>
                  {((stats.simulationTests / stats.totalTests) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </ScreenContainer>
  );
};

const getBandColor = (band: number, colors: ColorTokens): string => {
  if (band >= 8) return colors.success;
  if (band >= 7) return colors.primary;
  if (band >= 6) return colors.warning;
  if (band >= 5) return colors.danger;
  return colors.textMuted;
};

const capitalizeFirst = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: spacing.xl * 3,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: "center",
  },
  advancedToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: colors.primaryOn,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: (screenWidth - spacing.xl * 2 - spacing.md) / 2,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  trendBadge: {
    marginBottom: spacing.xs,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    height: 200,
    paddingTop: spacing.md,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "60%",
    minHeight: 20,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryOn,
  },
  barAxisLabel: {
    marginTop: spacing.xs,
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  criteriaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  criteriaLabel: {
    width: 120,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  criteriaBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: spacing.sm,
  },
  criteriaBarFill: {
    height: "100%",
    borderRadius: 12,
  },
  criteriaScore: {
    width: 40,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  monthlyChart: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: spacing.md,
  },
  monthColumn: {
    alignItems: "center",
    flex: 1,
  },
  monthBar: {
    width: 32,
    height: 100,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 16,
    justifyContent: "flex-end",
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  monthBarFill: {
    width: "100%",
    borderRadius: 16,
  },
  monthScore: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  monthLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  monthTests: {
    fontSize: 10,
    color: colors.textMuted,
  },
  twoColumn: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  column: {
    flex: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  listItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  noDataText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  breakdown: {
    gap: spacing.lg,
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  breakdownIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  breakdownPercentage: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textMuted,
  },
  });
