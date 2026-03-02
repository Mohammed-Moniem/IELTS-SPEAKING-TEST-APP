import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import {
  typingIndicatorService,
  TypingUser,
} from "../../services/typingIndicatorService";
import type { ColorTokens } from "../../theme/tokens";

interface TypingIndicatorProps {
  conversationId: string;
  currentUserId?: string;
  style?: any;
}

/**
 * TypingIndicator Component
 * Displays animated typing indicator when users are typing
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  conversationId,
  currentUserId,
  style,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [typingText, setTypingText] = useState<string>("");

  // Animation values for dots
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Subscribe to typing updates for this conversation
    const unsubscribe = typingIndicatorService.subscribe(
      (updatedConversationId, updatedTypingUsers) => {
        if (updatedConversationId === conversationId) {
          // Filter out current user
          const filteredUsers = currentUserId
            ? updatedTypingUsers.filter((user) => user.userId !== currentUserId)
            : updatedTypingUsers;

          setTypingUsers(filteredUsers);
          setTypingText(
            typingIndicatorService.formatTypingText(
              conversationId,
              currentUserId
            )
          );
        }
      }
    );

    // Get initial typing users
    const initialUsers = typingIndicatorService.getTypingUsers(conversationId);
    const filteredUsers = currentUserId
      ? initialUsers.filter((user) => user.userId !== currentUserId)
      : initialUsers;

    setTypingUsers(filteredUsers);
    setTypingText(
      typingIndicatorService.formatTypingText(conversationId, currentUserId)
    );

    return unsubscribe;
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (typingUsers.length === 0) {
      // Stop animation
      dot1Opacity.stopAnimation();
      dot2Opacity.stopAnimation();
      dot3Opacity.stopAnimation();
      return;
    }

    // Animate dots
    const animateDot = (
      dotOpacity: Animated.Value,
      delay: number
    ): Animated.CompositeAnimation => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dotOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacity, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with staggered delays
    const animation1 = animateDot(dot1Opacity, 0);
    const animation2 = animateDot(dot2Opacity, 200);
    const animation3 = animateDot(dot3Opacity, 400);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [typingUsers, dot1Opacity, dot2Opacity, dot3Opacity]);

  if (typingUsers.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
        </View>
      </View>
      {typingText && <Text style={styles.typingText}>{typingText}</Text>}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "column",
      alignItems: "flex-start",
      marginHorizontal: 16,
      marginVertical: 4,
    },
    bubble: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 50,
    },
    dotsContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textMuted,
    },
    typingText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      marginLeft: 12,
      fontStyle: "italic",
    },
  });
