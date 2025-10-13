import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const QRCodeScannerScreen: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const handleRequestPermission = () => {
    Alert.alert(
      "Camera Permission",
      "This feature requires camera access to scan QR codes. Please enable camera permission in your device settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            // In a real app, open device settings
            console.log("Open settings");
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="qr-code-outline" size={80} color="#007AFF" />
        </View>
        <Text style={styles.title}>QR Code Scanner</Text>
        <Text style={styles.description}>
          Scan a friend's QR code to quickly add them
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleRequestPermission}
        >
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Enable Camera</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#8E8E93" />
          <Text style={styles.infoText}>
            You'll need to grant camera permission to use the QR scanner
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 17,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    maxWidth: 320,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
});
