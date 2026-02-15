import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import monitoringService from "../services/monitoringService";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("🚨 ErrorBoundary caught error:", error);
    console.error("📍 Component stack:", errorInfo.componentStack);

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
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle" size={80} color="#FF3B30" />

          <Text style={styles.title}>Oops! Something went wrong</Text>

          <Text style={styles.message}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>

          {__DEV__ && this.state.errorInfo && (
            <ScrollView style={styles.debugContainer}>
              <Text style={styles.debugTitle}>
                Debug Info (Development Only):
              </Text>
              <Text style={styles.debugText}>{this.state.error?.stack}</Text>
              <Text style={styles.debugText}>
                {this.state.errorInfo.componentStack}
              </Text>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Ionicons
              name="refresh"
              size={20}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            If the problem persists, please restart the app
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F2F2F7",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 12,
    color: "#000",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  debugContainer: {
    maxHeight: 200,
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#FF3B30",
  },
  debugText: {
    fontSize: 11,
    color: "#666",
    fontFamily: "monospace",
    lineHeight: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  helpText: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 16,
    textAlign: "center",
  },
});
