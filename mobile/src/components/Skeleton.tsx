import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  DimensionValue,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { colors } from "../theme/tokens";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Basic shimmering skeleton block used to compose loading placeholders.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%" as DimensionValue,
  height = 16,
  radius = 12,
  style,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shimmer.setValue(0);
    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loopAnimation.start();
    return () => {
      loopAnimation.stop();
    };
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        { width, height, borderRadius: radius },
        style,
      ])}
    >
      <AnimatedLinearGradient
        colors={[highlightColor, baseColor, highlightColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.flatten([
          StyleSheet.absoluteFillObject,
          {
            transform: [{ translateX }],
          },
        ])}
      />
    </View>
  );
};

const baseColor = colors.surfaceSubtle;
const highlightColor = colors.surface;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: baseColor,
  },
});
