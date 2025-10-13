import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useProfile } from "../../hooks";

export const QRCodeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { generateQRCode } = useProfile();
  const [qrData, setQRData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQRCode();
  }, []);

  const loadQRCode = async () => {
    setLoading(true);
    const data = await generateQRCode();
    setQRData(data);
    setLoading(false);
  };

  const handleShare = async () => {
    if (!qrData) return;

    try {
      await Share.share({
        message: `Add me on IELTS Practice App! ${qrData}`,
        title: "Add Friend",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>My QR Code</Text>
        <Text style={styles.description}>
          Let friends scan this code to add you
        </Text>
      </View>

      {loading || !qrData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <>
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrData}
                size={250}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share QR Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Friends can scan this code using the QR scanner in the Social tab
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
  },
  loadingContainer: {
    padding: 64,
    alignItems: "center",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  qrWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actions: {
    marginBottom: 24,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#E8F4FF",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: "#007AFF",
    lineHeight: 20,
  },
});
