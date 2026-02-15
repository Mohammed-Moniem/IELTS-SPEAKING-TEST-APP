import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  headers?: Record<string, string>;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  imageUrl,
  onClose,
  headers,
}) => {
  const [loading, setLoading] = useState(true);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        {/* Status bar for Android */}
        {Platform.OS === "android" && (
          <StatusBar
            backgroundColor="rgba(0, 0, 0, 0.9)"
            barStyle="light-content"
          />
        )}

        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <View style={styles.closeButtonCircle}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl, headers }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />

          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Tap anywhere to close hint */}
        <TouchableOpacity
          style={styles.tapArea}
          activeOpacity={1}
          onPress={onClose}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 10,
  },
  closeButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  tapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
});
