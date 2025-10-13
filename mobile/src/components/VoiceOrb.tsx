import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
}

const { width } = Dimensions.get("window");
const ORB_SIZE = width * 0.6; // 60% of screen width

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening,
  isSpeaking,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSpeaking) {
      // AI is speaking - strong pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        })
      ).start();
    } else if (isListening) {
      // User is speaking - subtle pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Idle - gentle rotation
      pulseAnim.setValue(1);
      glowAnim.setValue(0);

      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        })
      ).start();
    }

    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      rotateAnim.stopAnimation();
    };
  }, [isSpeaking, isListening]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.container}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Main orb */}
      <Animated.View
        style={[
          styles.orb,
          {
            transform: [{ scale: pulseAnim }, { rotate: spin }],
          },
        ]}
      >
        <View style={styles.gradient1} />
        <View style={styles.gradient2} />
        <View style={styles.gradient3} />
      </Animated.View>

      {/* Inner highlight */}
      <View style={styles.highlight} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#1a365d", // Deep navy
  },
  glow: {
    position: "absolute",
    width: ORB_SIZE * 1.3,
    height: ORB_SIZE * 1.3,
    borderRadius: (ORB_SIZE * 1.3) / 2,
    backgroundColor: "#d4a745", // Warm gold
    opacity: 0.3,
  },
  gradient1: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "#2d5a8f",
    opacity: 0.8,
  },
  gradient2: {
    position: "absolute",
    width: "80%",
    height: "80%",
    top: "10%",
    left: "10%",
    borderRadius: ORB_SIZE / 2,
    backgroundColor: "#4a7bb5",
    opacity: 0.6,
  },
  gradient3: {
    position: "absolute",
    width: "60%",
    height: "60%",
    top: "20%",
    left: "20%",
    borderRadius: ORB_SIZE / 2,
    backgroundColor: "#6b9ed9",
    opacity: 0.4,
  },
  highlight: {
    position: "absolute",
    width: ORB_SIZE * 0.3,
    height: ORB_SIZE * 0.3,
    top: ORB_SIZE * 0.15,
    left: ORB_SIZE * 0.35,
    borderRadius: (ORB_SIZE * 0.3) / 2,
    backgroundColor: "#ffffff",
    opacity: 0.2,
  },
});
