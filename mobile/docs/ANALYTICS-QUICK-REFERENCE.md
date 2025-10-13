# 📊 Advanced Analytics - Quick Reference

## Installation

```bash
npm install react-native-chart-kit
```

## Import Statements

```typescript
// Analytics Service
import analyticsService from "../services/analyticsService";

// Chart Components
import {
  ScoreLineChart,
  BandDistributionChart,
  CategoryPerformanceChart,
  TimeOfDayChart,
  ProgressPieChart,
} from "../components/charts/ChartComponents";

// Enhanced Analytics Screen
import { EnhancedAnalyticsScreen } from "../screens/Analytics/EnhancedAnalyticsScreen";
```

---

## Analytics Service API

### Calculate Progress Statistics

```typescript
const stats = analyticsService.calculateProgressStats(practices, simulations);

// Returns:
{
  totalSessions: 25,
  averageScore: 6.8,
  highestScore: 7.5,
  lowestScore: 5.5,
  improvementRate: 15,  // +15%
  currentStreak: 7,
  longestStreak: 14
}
```

### Get Score Data Points

```typescript
const dataPoints = analyticsService.getScoreDataPoints(practices, simulations);

// Returns array of:
[
  {
    date: "2025-10-01T10:30:00Z",
    score: 6.5,
    type: "practice",
    sessionId: "abc123",
  },
  // ... more points
];
```

### Calculate Score Trend

```typescript
const trend = analyticsService.calculateScoreTrend(dataPoints, 'month');

// Returns:
{
  period: 'month',
  dataPoints: [...],
  trendLine: [{ x: 0, y: 6.0 }, { x: 10, y: 7.0 }],
  averageScore: 6.5,
  improvement: 12  // +12%
}
```

### Calculate Category Performance

```typescript
const categoryPerf = analyticsService.calculateCategoryPerformance(practices);

// Returns:
[
  {
    category: "Part 1",
    averageScore: 7.2,
    sessionCount: 10,
    latestScore: 7.5,
    trend: "improving",
  },
  // ... Part 2, Part 3
];
```

### Calculate Time of Day Stats

```typescript
const timeStats = analyticsService.calculateTimeOfDayStats(
  practices,
  simulations
);

// Returns:
[
  {
    hour: 9,
    sessionCount: 5,
    averageScore: 7.0,
  },
  // ... other hours
];
```

### Calculate Band Distribution

```typescript
const distribution = analyticsService.calculateBandDistribution(
  practices,
  simulations
);

// Returns:
[
  { band: 6, count: 8, percentage: 32.0 },
  { band: 7, count: 12, percentage: 48.0 },
  { band: 8, count: 5, percentage: 20.0 },
];
```

---

## Chart Components Usage

### Score Line Chart

```typescript
<ScoreLineChart
  data={scoreDataPoints} // ScoreDataPoint[]
  height={220} // Optional, default: 220
/>
```

### Band Distribution Chart

```typescript
<BandDistributionChart
  data={bandDistribution} // { band, count, percentage }[]
  height={220}
/>
```

### Category Performance Chart

```typescript
<CategoryPerformanceChart
  data={categoryPerformance} // { category, averageScore, sessionCount }[]
  height={220}
/>
```

### Time of Day Chart

```typescript
<TimeOfDayChart
  data={timeOfDayStats} // { hour, sessionCount, averageScore }[]
  height={220}
/>
```

### Progress Pie Chart

```typescript
<ProgressPieChart
  data={[
    {
      name: "Excellent",
      population: 10,
      color: "#10B981",
      legendFontColor: "#1F2937",
      legendFontSize: 12,
    },
    // ... more slices
  ]}
  height={220}
/>
```

---

## Complete Usage Example

```typescript
import React from "react";
import { ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { practiceApi, simulationApi } from "../api/services";
import analyticsService from "../services/analyticsService";
import {
  ScoreLineChart,
  BandDistributionChart,
  CategoryPerformanceChart,
} from "../components/charts/ChartComponents";

export const MyAnalyticsScreen = () => {
  // Fetch data
  const { data: practices = [] } = useQuery({
    queryKey: ["practices"],
    queryFn: () => practiceApi.listSessions({ limit: 100 }),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => simulationApi.list({ limit: 100 }),
  });

  // Calculate analytics
  const stats = analyticsService.calculateProgressStats(practices, simulations);
  const dataPoints = analyticsService.getScoreDataPoints(
    practices,
    simulations
  );
  const categoryPerf = analyticsService.calculateCategoryPerformance(practices);
  const bandDist = analyticsService.calculateBandDistribution(
    practices,
    simulations
  );

  return (
    <ScrollView>
      <Text>Average: {stats.averageScore}</Text>
      <Text>Sessions: {stats.totalSessions}</Text>
      <Text>Streak: {stats.currentStreak} days</Text>

      <ScoreLineChart data={dataPoints} />
      <CategoryPerformanceChart data={categoryPerf} />
      <BandDistributionChart data={bandDist} />
    </ScrollView>
  );
};
```

---

## Utility Functions

### Format Hour

```typescript
analyticsService.formatHour(9); // "9 AM"
analyticsService.formatHour(14); // "2 PM"
analyticsService.formatHour(0); // "12 AM"
```

### Get Trend Color

```typescript
analyticsService.getTrendColor("improving"); // "#10B981" (green)
analyticsService.getTrendColor("declining"); // "#EF4444" (red)
analyticsService.getTrendColor("stable"); // "#6B7280" (gray)
```

### Get Band Color

```typescript
analyticsService.getBandColor(8); // "#10B981" (excellent)
analyticsService.getBandColor(7); // "#3B82F6" (good)
analyticsService.getBandColor(6); // "#F59E0B" (competent)
analyticsService.getBandColor(5); // "#EF4444" (limited)
```

---

## Chart Configuration

### Custom Chart Config

```typescript
import { chartConfig } from "../components/charts/ChartComponents";

// Override default config
const myChartConfig = {
  ...chartConfig,
  color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Red
  decimalPlaces: 2,
};

<LineChart data={data} chartConfig={myChartConfig} />;
```

### Screen Width Responsive

```typescript
import { Dimensions } from "react-native";

const screenWidth = Dimensions.get("window").width;

// Charts automatically use: screenWidth - 60
```

---

## Common Patterns

### Filter by Period

```typescript
const calculateForPeriod = (period: "week" | "month" | "all") => {
  const dataPoints = analyticsService.getScoreDataPoints(
    practices,
    simulations
  );
  return analyticsService.calculateScoreTrend(dataPoints, period);
};

const weeklyTrend = calculateForPeriod("week");
const monthlyTrend = calculateForPeriod("month");
const allTimeTrend = calculateForPeriod("all");
```

### Compare Categories

```typescript
const categoryPerf = analyticsService.calculateCategoryPerformance(practices);

const part1 = categoryPerf.find((c) => c.category === "Part 1");
const part2 = categoryPerf.find((c) => c.category === "Part 2");

console.log(`Part 1: ${part1?.averageScore} (${part1?.trend})`);
console.log(`Part 2: ${part2?.averageScore} (${part2?.trend})`);
```

### Find Best Practice Time

```typescript
const timeStats = analyticsService.calculateTimeOfDayStats(
  practices,
  simulations
);

const bestTime = timeStats.reduce((best, current) =>
  current.averageScore > best.averageScore ? current : best
);

console.log(`Best time: ${analyticsService.formatHour(bestTime.hour)}`);
console.log(`Average score: ${bestTime.averageScore}`);
```

### Check Improvement

```typescript
const stats = analyticsService.calculateProgressStats(practices, simulations);

if (stats.improvementRate > 10) {
  console.log("Great progress! 🎉");
} else if (stats.improvementRate > 0) {
  console.log("Keep it up! 👍");
} else {
  console.log("Focus on weak areas 💪");
}
```

---

## Empty State Handling

### Check for Data

```typescript
if (practices.length === 0 && simulations.length === 0) {
  return <EmptyState />;
}
```

### Chart Empty States

All charts automatically show empty state when:

- Data array is empty
- All values are zero
- No valid data points

```typescript
// These all show "No data available"
<ScoreLineChart data={[]} />
<BandDistributionChart data={allZeros} />
```

---

## Performance Tips

1. **Limit Data Points** - Charts show last 10 points for line charts
2. **Memoize Calculations** - Use useMemo for expensive calculations
3. **Pagination** - Fetch limited sessions (e.g., last 100)
4. **Lazy Loading** - Load charts as user scrolls
5. **Caching** - Use React Query for automatic caching

### Optimization Example

```typescript
const stats = useMemo(
  () => analyticsService.calculateProgressStats(practices, simulations),
  [practices, simulations]
);

const dataPoints = useMemo(
  () => analyticsService.getScoreDataPoints(practices, simulations),
  [practices, simulations]
);
```

---

## Integration with Navigation

```typescript
import { EnhancedAnalyticsScreen } from "./screens/Analytics/EnhancedAnalyticsScreen";

// In your navigator
<Stack.Screen
  name="Analytics"
  component={EnhancedAnalyticsScreen}
  options={{
    title: "Your Progress",
    headerShown: true,
  }}
/>;

// Navigate to it
navigation.navigate("Analytics");
```

---

## Debugging

### Log Analytics Data

```typescript
const stats = analyticsService.calculateProgressStats(practices, simulations);
console.log("Analytics:", {
  total: stats.totalSessions,
  average: stats.averageScore,
  improvement: `${stats.improvementRate}%`,
  streak: stats.currentStreak,
});
```

### Verify Calculations

```typescript
// Check trend detection
const scores = [5.5, 5.8, 6.0, 6.5, 7.0];
const trend = analyticsService["calculateTrend"](scores);
console.log("Trend:", trend); // Should be "improving"

// Check improvement rate
const rate = analyticsService["calculateImprovementRate"](scores);
console.log("Improvement:", rate); // Should be positive
```

---

## Error Handling

```typescript
try {
  const stats = analyticsService.calculateProgressStats(practices, simulations);
  // Use stats
} catch (error) {
  console.error("Analytics error:", error);
  // Show fallback UI
}
```

---

## Testing

```typescript
describe("AnalyticsService", () => {
  it("calculates progress stats", () => {
    const stats = analyticsService.calculateProgressStats(mockPractices, []);
    expect(stats.totalSessions).toBe(10);
    expect(stats.averageScore).toBeGreaterThan(0);
  });

  it("detects improving trend", () => {
    const scores = [5.0, 5.5, 6.0, 6.5, 7.0];
    const trend = analyticsService["calculateTrend"](scores);
    expect(trend).toBe("improving");
  });

  it("calculates streaks correctly", () => {
    const dates = ["2025-10-01", "2025-10-02", "2025-10-03"];
    const streaks = analyticsService["calculateStreaks"](dates);
    expect(streaks.longestStreak).toBe(3);
  });
});
```

---

## Dependencies

- **react-native-chart-kit** - Chart rendering
- **react-native-svg** - SVG support (required by chart-kit)
- **@tanstack/react-query** - Data fetching and caching
- **@expo/vector-icons** - Icons for UI

---

**That's it! You're ready to visualize analytics. 📊**
