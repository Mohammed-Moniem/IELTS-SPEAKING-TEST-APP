/**
 * Chart Components
 * Reusable chart components for analytics visualizations using react-native-chart-kit
 */

import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { ScoreDataPoint } from "../../services/analyticsService";

const screenWidth = Dimensions.get("window").width;

const chartConfig = {
  backgroundColor: "#FFFFFF",
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: "6",
    strokeWidth: "2",
    stroke: "#6366F1",
  },
};

interface ScoreLineChartProps {
  data: ScoreDataPoint[];
  height?: number;
}

export const ScoreLineChart: React.FC<ScoreLineChartProps> = ({
  data,
  height = 220,
}) => {
  if (data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  // Prepare data for chart (last 10 data points max for readability)
  const recentData = data.slice(-10);
  const scores = recentData.map((point) => point.score);
  const labels = recentData.map((_, index) => `${index + 1}`);

  return (
    <View style={styles.chartContainer}>
      <LineChart
        data={{
          labels,
          datasets: [
            {
              data: scores,
            },
          ],
        }}
        width={screenWidth - 60}
        height={height}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        fromZero
        segments={3}
        yAxisLabel=""
        yAxisSuffix=""
        yAxisInterval={1}
      />
    </View>
  );
};

interface BandDistributionChartProps {
  data: { band: number; count: number; percentage: number }[];
  height?: number;
}

export const BandDistributionChart: React.FC<BandDistributionChartProps> = ({
  data,
  height = 220,
}) => {
  if (data.every((d) => d.count === 0)) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  // Filter and prepare data
  const filteredData = data.filter((d) => d.count > 0);
  const labels = filteredData.map((d) => `${d.band}`);
  const counts = filteredData.map((d) => d.count);

  return (
    <View style={styles.chartContainer}>
      <BarChart
        data={{
          labels,
          datasets: [
            {
              data: counts,
            },
          ],
        }}
        width={screenWidth - 60}
        height={height}
        chartConfig={{
          ...chartConfig,
          barPercentage: 0.7,
        }}
        style={styles.chart}
        fromZero
        showValuesOnTopOfBars
        yAxisLabel=""
        yAxisSuffix=""
      />
    </View>
  );
};

interface CategoryPerformanceChartProps {
  data: {
    category: string;
    averageScore: number;
    sessionCount: number;
  }[];
  height?: number;
}

export const CategoryPerformanceChart: React.FC<
  CategoryPerformanceChartProps
> = ({ data, height = 220 }) => {
  if (data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const labels = data.map((d) => d.category.replace("Part ", "P"));
  const scores = data.map((d) => d.averageScore);

  return (
    <View style={styles.chartContainer}>
      <BarChart
        data={{
          labels,
          datasets: [
            {
              data: scores,
            },
          ],
        }}
        width={screenWidth - 60}
        height={height}
        chartConfig={chartConfig}
        style={styles.chart}
        fromZero
        showValuesOnTopOfBars
        yAxisLabel=""
        yAxisSuffix=""
        segments={3}
      />
    </View>
  );
};

interface TimeOfDayChartProps {
  data: {
    hour: number;
    sessionCount: number;
    averageScore: number;
  }[];
  height?: number;
}

export const TimeOfDayChart: React.FC<TimeOfDayChartProps> = ({
  data,
  height = 220,
}) => {
  if (data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  // Format hour labels
  const formatHour = (hour: number): string => {
    if (hour === 0) return "12A";
    if (hour === 12) return "12P";
    if (hour < 12) return `${hour}A`;
    return `${hour - 12}P`;
  };

  const labels = data.map((d) => formatHour(d.hour));
  const counts = data.map((d) => d.sessionCount);

  return (
    <View style={styles.chartContainer}>
      <BarChart
        data={{
          labels,
          datasets: [
            {
              data: counts,
            },
          ],
        }}
        width={screenWidth - 60}
        height={height}
        chartConfig={{
          ...chartConfig,
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          barPercentage: 0.6,
        }}
        style={styles.chart}
        fromZero
        showValuesOnTopOfBars
        yAxisLabel=""
        yAxisSuffix=""
      />
    </View>
  );
};

interface ProgressPieChartProps {
  data: {
    name: string;
    population: number;
    color: string;
    legendFontColor: string;
    legendFontSize: number;
  }[];
  height?: number;
}

export const ProgressPieChart: React.FC<ProgressPieChartProps> = ({
  data,
  height = 220,
}) => {
  if (data.length === 0 || data.every((d) => d.population === 0)) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const filteredData = data.filter((d) => d.population > 0);

  return (
    <View style={styles.chartContainer}>
      <PieChart
        data={filteredData}
        width={screenWidth - 60}
        height={height}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginVertical: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    marginVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
});
