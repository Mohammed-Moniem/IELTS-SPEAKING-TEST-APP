# WhatsApp Message Bubbles - Visual Design Guide

## Color Palette

### Background Colors

- **App Background:** `#E5DDD5` (WhatsApp beige pattern color)
- **Sent Message Bubble:** `#DCF8C6` (WhatsApp green)
- **Received Message Bubble:** `#FFFFFF` (White)
- **Input Background:** `#FFFFFF` with `#E0E0E0` border
- **Bottom Bar:** `#F0F0F0`

### Text Colors

- **Message Text:** `#000000` (Black on both bubble types)
- **Timestamp:** `#667781` (WhatsApp gray)
- **Read Receipt:** `#4FC3F7` (Blue checkmarks)

### Accent Colors

- **Send Button:** `#128C7E` (WhatsApp green)
- **Attachment Button:** `#007AFF` (iOS blue)

---

## Typography

### Message Text

- Font Size: 16px
- Line Height: 22px
- Color: `#000000`

### Timestamp

- Font Size: 11px
- Color: `#667781`
- Weight: Regular

### Read Receipt

- Font Size: 14px
- Color: `#4FC3F7`
- Weight: 600
- Content: `✓` (sent) or `✓✓` (read)

---

## Bubble Dimensions

### Message Bubble

- Max Width: 80% of screen width
- Border Radius: 8px
- Padding Horizontal: 12px
- Padding Top: 8px
- Padding Bottom: 20px (extra space for timestamp)

### Bubble Tail

- Implemented using border triangle trick
- Size: 8px border width
- Position: Bottom corner (left for received, right for sent)
- Rotation: 45° (sent) or -45° (received)

---

## Spacing

### Message Spacing

- Vertical Margin: 2px between messages
- Horizontal Padding: 8px from screen edges

### Timestamp Spacing

- Position: Absolute
- Bottom: 4px from bubble bottom
- Right: 8px from bubble right
- Margin Right: 3px between timestamp and checkmarks

---

## Shadows & Elevation

### Message Bubble Shadow (iOS)

```javascript
shadowColor: "#000"
shadowOffset: { width: 0, height: 1 }
shadowOpacity: 0.18
shadowRadius: 1.5
```

### Message Bubble Elevation (Android)

```javascript
elevation: 2;
```

---

## Layout Structure

```
┌─────────────────────────────────────────┐
│  ChatScreen Container (#E5DDD5)         │
│                                         │
│  ┌──────────────────────┐               │
│  │ Received Message     │◄──(tail)     │
│  │ #FFFFFF              │               │
│  │ "Hello!"             │               │
│  │              11:30 AM│               │
│  └──────────────────────┘               │
│                                         │
│               ┌──────────────────────┐  │
│      (tail)──►│ Sent Message         │  │
│               │ #DCF8C6              │  │
│               │ "Hi there!"          │  │
│               │          11:31 AM ✓✓ │  │
│               └──────────────────────┘  │
│                                         │
│  ┌─────────────────────────────────────┤
│  │ [+] [Input Field...      ] [Send]   │
│  └─────────────────────────────────────┘
└─────────────────────────────────────────┘
```

---

## Bubble Tail Implementation

The bubble tail is created using the border triangle trick:

```javascript
tail: {
  position: "absolute",
  width: 0,
  height: 0,
  borderStyle: "solid",
  bottom: 0,
}

ownTail: {
  right: -5,
  borderWidth: 8,
  borderLeftColor: "transparent",
  borderRightColor: "transparent",
  borderTopColor: "#DCF8C6",  // Match bubble background
  borderBottomColor: "transparent",
  transform: [{ rotate: "45deg" }],
}

otherTail: {
  left: -5,
  borderWidth: 8,
  borderLeftColor: "transparent",
  borderRightColor: "transparent",
  borderTopColor: "#FFFFFF",  // Match bubble background
  borderBottomColor: "transparent",
  transform: [{ rotate: "-45deg" }],
}
```

---

## Timestamp Positioning

The timestamp is positioned absolutely inside the bubble:

```javascript
timestampContainer: {
  position: "absolute",
  bottom: 4,
  right: 8,
  flexDirection: "row",
  alignItems: "center",
}
```

To prevent text overlap, we add invisible spacing:

```javascript
<Text style={styles.messageText}>
  {item.content}
  <Text style={styles.timestampSpacing}>{"        "}</Text>
</Text>
```

---

## Interactive States

### Send Button

- **Active:** Green `#128C7E` with white icon
- **Disabled:** 50% opacity when no text input
- **Loading:** Shows spinner while sending

### Message Bubbles

- No press state (future: long-press for context menu)
- Smooth rendering with FlatList optimization

---

## Accessibility

- Timestamps are readable with sufficient contrast
- Read receipts provide visual feedback
- Color choices maintain WCAG AA compliance
- Text remains legible on all backgrounds

---

## Performance Considerations

1. **Pure StyleSheet** - No external image assets needed
2. **Border Trick** - More performant than SVG paths
3. **Absolute Positioning** - Minimal layout recalculations
4. **FlatList Optimization** - Inverted list with proper keyExtractor

---

## Future Enhancements

- [ ] Add long-press context menu
- [ ] Implement message reactions below bubble
- [ ] Add reply preview inside bubble
- [ ] Support link previews with thumbnails
- [ ] Add forwarded message indicator
- [ ] Implement message animation on send

---

## Testing Notes

Test the design with:

- Various message lengths (short, medium, long)
- Multiline messages
- Rapid message sending
- Different screen sizes
- Light/dark mode (future)
- RTL languages (future)

---

## References

- WhatsApp Web Design System
- Material Design Chat Patterns
- iOS iMessage Design Guidelines
- React Native StyleSheet Documentation
