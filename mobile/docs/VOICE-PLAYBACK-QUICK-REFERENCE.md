# 🎵 Voice Playback - Quick Reference

## Installation

```bash
npx expo install @react-native-community/slider
```

## Import Statements

```typescript
// Audio Player Component
import { AudioPlayer } from "../components/AudioPlayer";

// Audio Player Hook
import { useAudioPlayer } from "../hooks/useAudioPlayer";

// Audio Player Service (direct access)
import audioPlayerService from "../services/audioPlayerService";

// Recordings Screen
import { RecordingsScreen } from "../screens/Recordings/RecordingsScreen";
```

---

## Quick Usage Examples

### 1. Simple Audio Player

```typescript
import { AudioPlayer } from "../components/AudioPlayer";

function MyScreen() {
  return <AudioPlayer uri="https://example.com/audio.m4a" />;
}
```

### 2. Audio Player with All Options

```typescript
<AudioPlayer
  uri="file:///path/to/audio.m4a"
  showSpeedControl={true}
  showVolumeControl={true}
  autoPlay={false}
  style={{ margin: 16 }}
/>
```

### 3. Using the Hook

```typescript
import { useAudioPlayer } from "../hooks/useAudioPlayer";

function CustomPlayer({ audioUri }: { audioUri: string }) {
  const {
    isPlaying,
    isLoading,
    formattedPosition,
    formattedDuration,
    progress,
    loadAudio,
    play,
    pause,
    seekToPercent,
  } = useAudioPlayer();

  useEffect(() => {
    loadAudio(audioUri);
    return () => unload();
  }, [audioUri]);

  return (
    <View>
      <Text>
        {formattedPosition} / {formattedDuration}
      </Text>
      <Slider value={progress} onValueChange={seekToPercent} />
      <Button onPress={isPlaying ? pause : play}>
        {isPlaying ? "Pause" : "Play"}
      </Button>
    </View>
  );
}
```

### 4. Direct Service Usage

```typescript
import audioPlayerService from "../services/audioPlayerService";

// Load audio
await audioPlayerService.loadAudio("file:///audio.m4a");

// Control playback
await audioPlayerService.play();
await audioPlayerService.pause();
await audioPlayerService.stop();

// Seek to position (milliseconds)
await audioPlayerService.seekTo(30000); // 30 seconds

// Change speed
await audioPlayerService.setRate(1.5); // 1.5x speed

// Set volume
await audioPlayerService.setVolume(0.8); // 80% volume

// Subscribe to state changes
const unsubscribe = audioPlayerService.subscribe((state) => {
  console.log("Playback state:", state);
});

// Cleanup
unsubscribe();
await audioPlayerService.unloadAudio();
```

---

## API Reference

### AudioPlayer Component Props

| Prop                | Type        | Default      | Description                      |
| ------------------- | ----------- | ------------ | -------------------------------- |
| `uri`               | `string`    | **required** | Audio file URI (local or remote) |
| `showSpeedControl`  | `boolean`   | `true`       | Show playback speed buttons      |
| `showVolumeControl` | `boolean`   | `false`      | Show volume slider               |
| `autoPlay`          | `boolean`   | `false`      | Auto-play when loaded            |
| `style`             | `ViewStyle` | `undefined`  | Custom container styles          |

### useAudioPlayer Hook Return Value

```typescript
{
  // State
  isPlaying: boolean;
  isLoading: boolean;
  position: number; // milliseconds
  duration: number; // milliseconds
  currentUri: string | null;

  // Computed
  progress: number; // 0 to 1
  formattedPosition: string; // "MM:SS"
  formattedDuration: string; // "MM:SS"

  // Actions
  loadAudio: (uri: string) => Promise<boolean>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
  seekToPercent: (percent: number) => Promise<void>; // 0-100
  setRate: (rate: number) => Promise<void>; // 0.5 - 2.0
  setVolume: (volume: number) => Promise<void>; // 0.0 - 1.0
  unload: () => Promise<void>;
}
```

### AudioPlayerService Methods

```typescript
class AudioPlayerService {
  // Load audio
  loadAudio(uri: string): Promise<boolean>;

  // Playback control
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;

  // Position control
  seekTo(positionMillis: number): Promise<void>;

  // Settings
  setRate(rate: number): Promise<void>; // 0.5 to 2.0
  setVolume(volume: number): Promise<void>; // 0.0 to 1.0

  // State
  getState(): PlaybackState;
  getStatus(): Promise<AVPlaybackStatus | null>;
  isLoaded(): boolean;
  isPlaying(): boolean;

  // Subscription
  subscribe(callback: PlaybackCallback): () => void;

  // Utilities
  formatTime(millis: number): string;
  unloadAudio(): Promise<void>;
  destroy(): Promise<void>;
}
```

### PlaybackState Interface

```typescript
interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  position: number; // milliseconds
  duration: number; // milliseconds
  uri: string | null;
}
```

---

## Common Patterns

### Play/Pause Toggle

```typescript
const { isPlaying, play, pause } = useAudioPlayer();

<Button onPress={isPlaying ? pause : play}>
  {isPlaying ? "Pause" : "Play"}
</Button>;
```

### Progress Bar with Seek

```typescript
const { progress, seekToPercent } = useAudioPlayer();

<Slider
  value={progress}
  onSlidingComplete={(value) => seekToPercent(value * 100)}
/>;
```

### Speed Control Buttons

```typescript
const { setRate } = useAudioPlayer();
const [speed, setSpeed] = useState(1.0);

const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

<View style={{ flexDirection: "row" }}>
  {speeds.map((s) => (
    <Button
      key={s}
      onPress={() => {
        setSpeed(s);
        setRate(s);
      }}
      variant={speed === s ? "solid" : "outline"}
    >
      {s}x
    </Button>
  ))}
</View>;
```

### Auto-cleanup on Unmount

```typescript
const { loadAudio, unload } = useAudioPlayer();

useEffect(() => {
  loadAudio(audioUri);

  return () => {
    unload(); // Cleanup when component unmounts
  };
}, [audioUri]);
```

### Subscribe to State Changes

```typescript
useEffect(() => {
  const unsubscribe = audioPlayerService.subscribe((state) => {
    console.log("Position:", state.position);
    console.log("Duration:", state.duration);
    console.log("Is Playing:", state.isPlaying);
  });

  return unsubscribe;
}, []);
```

---

## Playback Speed Presets

| Speed | Use Case                            |
| ----- | ----------------------------------- |
| 0.5x  | Detailed analysis, catch every word |
| 0.75x | Slower pace for difficult sections  |
| 1.0x  | Normal speed (default)              |
| 1.25x | Slightly faster review              |
| 1.5x  | Quick review of familiar content    |
| 2.0x  | Speed listening for gist            |

---

## Error Handling

### Loading Errors

```typescript
const success = await loadAudio(audioUri);
if (!success) {
  Alert.alert("Error", "Failed to load audio file");
}
```

### Playback Errors

```typescript
try {
  await play();
} catch (error) {
  console.error("Playback error:", error);
  Alert.alert("Error", "Failed to play audio");
}
```

### Network Issues (Remote Audio)

```typescript
const { isLoading, error } = useAudioPlayer();

if (isLoading) {
  return <ActivityIndicator />;
}

if (error) {
  return <Text>Failed to load audio</Text>;
}
```

---

## Time Formatting

```typescript
// Milliseconds to MM:SS
audioPlayerService.formatTime(125000); // "2:05"
audioPlayerService.formatTime(65000); // "1:05"
audioPlayerService.formatTime(5000); // "0:05"
```

---

## Advanced Usage

### Custom Player with Waveform

```typescript
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import Waveform from "react-native-waveform";

function WaveformPlayer({ uri }: { uri: string }) {
  const { position, duration, seekTo, play, pause } = useAudioPlayer();

  return (
    <>
      <Waveform
        source={{ uri }}
        currentTime={position / 1000}
        onSeek={(time) => seekTo(time * 1000)}
      />
      <Button onPress={play}>Play</Button>
    </>
  );
}
```

### Picture-in-Picture Mode

```typescript
useEffect(() => {
  // Setup background audio mode
  Audio.setAudioModeAsync({
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
  });
}, []);
```

### Multiple Players (Not Recommended)

```typescript
// Only one AudioPlayerService instance exists (singleton)
// To play multiple audios, unload the current one first

const switchAudio = async (newUri: string) => {
  await unload();
  await loadAudio(newUri);
  await play();
};
```

---

## Debugging

### Check Current State

```typescript
const state = audioPlayerService.getState();
console.log("State:", state);
```

### Get Full Status

```typescript
const status = await audioPlayerService.getStatus();
console.log("Status:", status);
```

### Log Playback Events

```typescript
audioPlayerService.subscribe((state) => {
  console.log(
    `[AUDIO] ${state.isPlaying ? "▶️" : "⏸️"} ${audioPlayerService.formatTime(
      state.position
    )} / ${audioPlayerService.formatTime(state.duration)}`
  );
});
```

---

## Performance Tips

1. **Unload when done** - Always call `unload()` to free memory
2. **Use autoPlay sparingly** - Let users initiate playback
3. **Optimize audio files** - Use compressed formats (M4A, MP3)
4. **Cache remote files** - Download and store locally for repeated playback
5. **Limit simultaneous players** - Use singleton pattern (already implemented)

---

## Common Issues & Solutions

### Audio Not Playing

```typescript
// Check if audio is loaded
if (!audioPlayerService.isLoaded()) {
  await loadAudio(uri);
}

// Check audio mode configuration
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
});
```

### Playback Stuttering

```typescript
// Use local files instead of streaming
// Or cache remote files first
import * as FileSystem from "expo-file-system";

const cacheAudio = async (remoteUri: string) => {
  const filename = remoteUri.split("/").pop();
  const localUri = FileSystem.cacheDirectory + filename;
  await FileSystem.downloadAsync(remoteUri, localUri);
  return localUri;
};
```

### Memory Leaks

```typescript
// Always cleanup in useEffect
useEffect(() => {
  loadAudio(uri);
  return () => unload(); // Critical!
}, [uri]);
```

---

## Integration with Recordings Screen

```typescript
// Add to your navigation stack
import { RecordingsScreen } from "./screens/Recordings/RecordingsScreen";

<Stack.Screen
  name="Recordings"
  component={RecordingsScreen}
  options={{
    title: "My Recordings",
    headerShown: true,
  }}
/>;

// Navigate to it
navigation.navigate("Recordings");
```

---

## Testing

```typescript
// Test audio loading
await loadAudio("https://example.com/test.m4a");
expect(isLoaded()).toBe(true);

// Test playback
await play();
expect(isPlaying()).toBe(true);

// Test seeking
await seekTo(30000); // 30 seconds
const state = getState();
expect(state.position).toBe(30000);
```

---

## Dependencies

- **expo-av** - Audio playback API
- **@react-native-community/slider** - Progress bar component
- **@expo/vector-icons** - Icons for controls

---

**That's it! You're ready to use the Voice Playback feature. 🎵**
