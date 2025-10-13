# IELTS Speaking Practice Web App PRD

A web-based IELTS speaking practice application that helps users improve their English speaking skills through structured practice sessions and AI-powered feedback.

**Experience Qualities**:
1. **Supportive** - Creates a safe, encouraging environment for learners to practice without judgment
2. **Focused** - Eliminates distractions to help users concentrate on their speaking practice
3. **Progressive** - Shows clear improvement over time through structured practice and feedback

**Complexity Level**: Light Application (multiple features with basic state)
- This is a focused practice tool that provides structured speaking exercises with basic progress tracking and feedback

## Essential Features

### Speaking Practice Sessions
- **Functionality**: Guided speaking practice with IELTS-style questions and topics
- **Purpose**: Helps users become familiar with IELTS question formats and practice speaking fluently
- **Trigger**: User selects a practice topic from the available categories
- **Progression**: Select topic → Read question → Record response → View feedback → Save progress
- **Success criteria**: Users can complete practice sessions and receive constructive feedback

### Practice History & Progress
- **Functionality**: Track completed sessions, topics practiced, and improvement over time
- **Purpose**: Shows users their consistency and helps them identify areas for improvement
- **Trigger**: Automatically logged after each practice session
- **Progression**: Complete session → Auto-save to history → View in progress dashboard
- **Success criteria**: Users can see their practice streak and completed topics

### AI-Powered Feedback
- **Functionality**: Generate personalized feedback on speaking responses using AI
- **Purpose**: Provides immediate, constructive suggestions for improvement
- **Trigger**: After user completes a speaking practice session
- **Progression**: Submit response → AI analyzes content → Generate feedback → Display suggestions
- **Success criteria**: Users receive relevant, actionable feedback on their responses

## Edge Case Handling
- **Microphone Access Issues**: Graceful fallback to text-based practice mode
- **Network Connectivity**: Local storage for progress when offline, sync when reconnected
- **Empty Responses**: Gentle prompts to encourage users to try again
- **Long Responses**: Automatic time limits with helpful reminders

## Design Direction
The design should feel **encouraging and professional** - like having a supportive tutor. Clean, minimal interface that reduces anxiety and helps users focus on learning rather than navigating complex features.

## Color Selection
**Complementary (opposite colors)** - Using calming blues with warm accent colors to create a balanced, trustworthy learning environment.

- **Primary Color**: Calm Professional Blue `oklch(0.45 0.15 240)` - Communicates trust and focus
- **Secondary Colors**: Light Blue `oklch(0.92 0.05 240)` for backgrounds, creating a serene learning space
- **Accent Color**: Warm Orange `oklch(0.65 0.18 50)` for encouragement and positive feedback
- **Foreground/Background Pairings**: 
  - Background (Light Blue): Dark Blue text `oklch(0.25 0.15 240)` - Ratio 8.2:1 ✓
  - Card (White): Dark Blue text `oklch(0.25 0.15 240)` - Ratio 12.1:1 ✓
  - Primary (Blue): White text `oklch(0.98 0.02 240)` - Ratio 7.5:1 ✓
  - Accent (Warm Orange): White text `oklch(0.98 0.02 50)` - Ratio 4.9:1 ✓

## Font Selection
**Professional yet approachable typography** that supports clear communication and reduces reading fatigue during practice sessions.

- **Typographic Hierarchy**:
  - H1 (App Title): Inter Bold/32px/tight letter spacing
  - H2 (Section Headers): Inter Semibold/24px/normal spacing  
  - H3 (Practice Topics): Inter Medium/18px/normal spacing
  - Body (Instructions): Inter Regular/16px/relaxed line height
  - Small (Metadata): Inter Regular/14px/normal spacing

## Animations
**Subtle and supportive** animations that guide users through their practice journey without causing distraction during focused speaking exercises.

- **Purposeful Meaning**: Gentle transitions create a sense of progress and achievement
- **Hierarchy of Movement**: Recording states get priority, followed by feedback reveals, then navigation

## Component Selection
- **Components**: Card for practice sessions, Button for primary actions, Progress for streaks, Badge for completed topics, Dialog for feedback display
- **Customizations**: Custom recording component with visual feedback, progress rings for practice streaks
- **States**: Recording (active pulse), completed (checkmark), locked (disabled with explanation)
- **Icon Selection**: Microphone for recording, Play for playback, CheckCircle for completion, TrendingUp for progress
- **Spacing**: Consistent 4/6/8 spacing scale using Tailwind's system
- **Mobile**: Stacked layout on mobile with larger touch targets for recording buttons, simplified navigation