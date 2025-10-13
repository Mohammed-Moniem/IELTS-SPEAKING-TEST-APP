# 🚀 Quick Start Guide - Audio Recording Feature

## Prerequisites

1. **Backend Setup**

   ```bash
   cd "micro-service-boilerplate-main 2"
   npm install
   ```

2. **Environment Variables** (`.env` file)

   ```env
   OPENAI_API_KEY=your_key_here
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=4000
   ```

3. **Mobile Setup**
   ```bash
   cd mobile
   npm install
   ```

## Running the Application

### 1. Start Backend Server

```bash
cd "micro-service-boilerplate-main 2"
npm run dev
```

Should see:

```
Server running on http://localhost:4000
Connected to MongoDB
```

### 2. Start Mobile App

```bash
cd mobile
npm start
```

Choose platform:

- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code for physical device

## Testing Audio Recording

### Step-by-Step Test Flow

1. **Register/Login**

   - Create account or login
   - Should see home screen with Practice/Simulation tabs

2. **Start Practice Session**

   - Tap "Practice" tab
   - Select any topic (or the app will generate one using AI)
   - Tap topic to start session

3. **Record Audio Answer**

   - You'll see the question with two mode buttons: 🎤 Audio | ✍️ Text
   - Audio mode should be selected by default
   - Tap the large blue microphone button
   - **First time**: Grant microphone permission
   - Speak your answer (max 2 minutes)
   - Watch the timer count up
   - See the waveform animation
   - Tap the green stop button when finished

4. **Submit Recording**

   - You'll see a green banner: "✓ Recording saved (Xs)"
   - Tap "Submit Recording" button
   - Watch the upload progress bar
   - Backend will:
     - Save the audio file
     - Transcribe using Whisper API
     - Evaluate using IELTS criteria
     - Return feedback

5. **View Results**
   - After upload completes, you'll see transcription text
   - Alert shows success message
   - Navigate back to Practice history
   - Find your session in the list
   - View detailed feedback with band scores

## Expected Behavior

### ✅ What Should Happen

- **Recording**: Smooth animations, clear timer, progress bar
- **Upload**: Progress indicator shows 0% → 100%
- **Transcription**: Accurate text from Whisper API
- **Feedback**: 4 band scores (Fluency, Lexical, Grammar, Pronunciation) + overall band + detailed comments

### 🐛 If Something Goes Wrong

**Recording doesn't start:**

- Check microphone permissions in device settings
- Try restarting the app
- Check console for permission errors

**Upload fails:**

- Verify backend is running on port 4000
- Check backend logs for errors
- Ensure audio file < 50MB
- Check network connection

**No transcription:**

- Verify `OPENAI_API_KEY` in backend `.env`
- Check backend console for Whisper API errors
- Ensure audio file has actual speech (not silence)

**No feedback:**

- Check backend logs for GPT-4 API errors
- Verify OpenAI API has sufficient credits
- Check practice session was properly saved

## API Endpoints Being Used

### 1. Start Practice Session

```
POST /api/v1/practice/sessions
Body: { topicId: string }
Response: { sessionId, topic, question, timeLimit, tips }
```

### 2. Upload Audio (NEW!)

```
POST /api/v1/practice/sessions/:sessionId/audio
Content-Type: multipart/form-data
Body: audio file
Response: { session with transcription + feedback }
```

### 3. Get Practice History

```
GET /api/v1/practice/sessions
Response: Array of completed sessions
```

## Debugging Tips

### Backend Logs to Watch

```bash
# In backend terminal, look for:
[INFO] Audio file saved: /path/to/file.m4a
[INFO] Transcription started...
[INFO] Transcription completed: "Your transcribed text..."
[INFO] Feedback generation started...
[INFO] Feedback generated with band: 6.5
```

### Mobile Logs

```bash
# In metro bundler terminal, look for:
LOG  Recording started
LOG  Recording stopped: 45s
LOG  Uploading audio...
LOG  Upload progress: 50%
LOG  Upload complete!
```

### Common Issues

**"Cannot connect to backend"**

- Backend not running on port 4000
- Mobile using wrong API URL
- Check `mobile/app.json` → `extra.apiUrl`

**"Audio upload timeout"**

- Recording too long (> 50MB)
- Slow network connection
- Backend processing timeout (increase timeout in axios config)

**"Transcription failed"**

- Invalid OpenAI API key
- Audio file corrupted
- No speech detected in audio
- Unsupported audio format

## Next Steps After Testing

Once audio recording works:

1. **Test Text Mode**

   - Switch to "Text" mode
   - Type an answer
   - Submit as text
   - Verify feedback still works

2. **Test Edge Cases**

   - Very short recording (< 5 seconds)
   - Long recording (approaching max duration)
   - Cancel recording mid-way
   - Upload failure (disconnect network)

3. **Check History**

   - View past sessions
   - See audio indicator on audio sessions
   - Play back audio (if implemented)
   - Review feedback scores

4. **Begin Phase 3**
   - Start implementing WebSocket service
   - Real-time conversation for Full Simulation mode
   - See `IMPLEMENTATION_PLAN.md` Phase 3

## Performance Benchmarks

### Expected Times

- **Recording**: Instant start
- **Upload**: 2-5 seconds for 30-second recording
- **Transcription**: 3-8 seconds (depends on Whisper API)
- **Feedback**: 5-10 seconds (depends on GPT-4 API)
- **Total**: ~10-25 seconds from submit to feedback

### File Sizes

- **30 seconds**: ~500KB
- **60 seconds**: ~1MB
- **120 seconds**: ~2MB

All well under the 50MB limit!

## Support & Resources

- **Implementation Guide**: See `MOBILE_AUDIO_GUIDE.md`
- **Progress Tracking**: See `PROGRESS_SUMMARY.md`
- **Full Roadmap**: See `IMPLEMENTATION_PLAN.md`
- **Backend API**: Check `API-Testing-Guide.md`

---

**Happy Testing! 🎤✨**
