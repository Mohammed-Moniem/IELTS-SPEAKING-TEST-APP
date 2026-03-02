import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../context";
import monitoringService from "../services/monitoringService";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { logger } from "../utils/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryInternalProps extends ErrorBoundaryProps {
  colors: ColorTokens;
}

class ErrorBoundaryInternal extends React.Component<
  ErrorBoundaryInternalProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryInternalProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.warn("⚠️ ErrorBoundary caught error:", error);
    logger.warn("📍 Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });

    monitoringService.captureException(error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const styles = createStyles(this.props.colors);

    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={80} color={this.props.colors.danger} />

        <Text style={styles.title}>Oops! Something went wrong</Text>

        <Text style={styles.message}>
          {this.state.error?.message || "An unexpected error occurred"}
        </Text>

        {__DEV__ && this.state.errorInfo ? (
          <ScrollView style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Info (Development Only):</Text>
            <Text style={styles.debugText}>{this.state.error?.stack}</Text>
            <Text style={styles.debugText}>{this.state.errorInfo.componentStack}</Text>
          </ScrollView>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          accessibilityHint="Reset the app view after an unexpected error"
        >
          <Ionicons
            name="refresh"
            size={20}
            color={this.props.colors.primaryOn}
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          If the problem persists, please restart the app.
        </Text>
      </View>
    );
  }
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const { colors } = useTheme();
  return <ErrorBoundaryInternal colors={colors}>{children}</ErrorBoundaryInternal>;
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
      backgroundColor: colors.backgroundMuted,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      color: colors.textPrimary,
      textAlign: "center",
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      lineHeight: 22,
    },
    debugContainer: {
      maxHeight: 220,
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    debugTitle: {
      fontSize: 14,
      fontWeight: "700",
      marginBottom: spacing.xs,
      color: colors.danger,
    },
    debugText: {
      fontSize: 11,
      color: colors.textMutedStrong,
      lineHeight: 16,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      elevation: 2,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
    },
    buttonIcon: {
      marginRight: spacing.xs,
    },
    buttonText: {
      color: colors.primaryOn,
      fontSize: 16,
      fontWeight: "600",
    },
    helpText: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: spacing.md,
      textAlign: "center",
    },
  });
