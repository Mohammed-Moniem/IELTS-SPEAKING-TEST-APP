/**
 * Audio Player Component
 * Displays audio playback controls with progress bar
 */

import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

interface AudioPlayerProps {
  /** Audio file URI to play */
  uri: string;
  /** Show playback speed controls */
  showSpeedControl?: boolean;
  /** Show volume control */
  showVolumeControl?: boolean;
  /** Auto-play when loaded */
  autoPlay?: boolean;
  /** Custom styles */
  style?: any;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  uri,
  showSpeedControl = true,
  showVolumeControl = false,
  autoPlay = false,
  style,
}) => {
  const {
    isPlaying,
    isLoading,
    position,
    duration,
    progress,
    formattedPosition,
    formattedDuration,
    loadAudio,
    play,
    pause,
    stop,
    seekToPercent,
    setRate,
    setVolume,
    unload,
  } = useAudioPlayer();

  const [playbackRate, setPlaybackRate] = React.useState(1.0);
  const [volume, setVolumeState] = React.useState(1.0);

  // Load audio when URI changes
  useEffect(() => {
    const load = async () => {
      const success = await loadAudio(uri);
      if (success && autoPlay) {
        await play();
      }
    };

    load();

    return () => {
      unload();
    };
  }, [uri]);

  // Handle play/pause toggle
  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  // Handle stop/reset
  const handleStop = async () => {
    await stop();
  };

  // Handle seek
  const handleSeek = async (value: number) => {
    await seekToPercent(value * 100);
  };

  // Handle playback speed change
  const handleSpeedChange = async (rate: number) => {
    setPlaybackRate(rate);
    await setRate(rate);
  };

  // Handle volume change
  const handleVolumeChange = async (vol: number) => {
    setVolumeState(vol);
    await setVolume(vol);
  };

  // Playback speed options
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <View style={[styles.container, style]}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formattedPosition}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={progress}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor="#6366F1"
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor="#6366F1"
          disabled={isLoading || duration === 0}
        />
        <Text style={styles.timeText}>{formattedDuration}</Text>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlsContainer}>
        {/* Stop/Reset Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleStop}
          disabled={isLoading}
        >
          <Ionicons
            name="refresh"
            size={24}
            color={isLoading ? "#9CA3AF" : "#374151"}
          />
        </TouchableOpacity>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.playButton]}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <Text style={styles.loadingText}>...</Text>
          ) : isPlaying ? (
            <Ionicons name="pause" size={32} color="#FFFFFF" />
          ) : (
            <Ionicons name="play" size={32} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        {/* Volume Control */}
        {showVolumeControl && (
          <View style={styles.volumeContainer}>
            <Ionicons name="volume-medium" size={20} color="#374151" />
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onSlidingComplete={handleVolumeChange}
              minimumTrackTintColor="#6366F1"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#6366F1"
            />
          </View>
        )}
      </View>

      {/* Speed Control */}
      {showSpeedControl && (
        <View style={styles.speedContainer}>
          <Text style={styles.speedLabel}>Speed:</Text>
          {speedOptions.map((rate) => (
            <TouchableOpacity
              key={rate}
              style={[
                styles.speedButton,
                playbackRate === rate && styles.speedButtonActive,
              ]}
              onPress={() => handleSpeedChange(rate)}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.speedButtonText,
                  playbackRate === rate && styles.speedButtonTextActive,
                ]}
              >
                {rate}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    width: 45,
    textAlign: "center",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6366F1",
    borderWidth: 0,
  },
  loadingText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  volumeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  volumeSlider: {
    width: 80,
    marginLeft: 8,
  },
  speedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  speedLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginRight: 8,
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  speedButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  speedButtonText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  speedButtonTextActive: {
    color: "#FFFFFF",
  },
});
