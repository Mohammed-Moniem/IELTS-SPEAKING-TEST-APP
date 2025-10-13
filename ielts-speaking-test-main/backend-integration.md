# IELTS Speaking Practice - Backend Integration Guide

## Project Overview

This document outlines the backend requirements for the IELTS Speaking Practice application, designed to support user authentication, practice tracking, AI-powered feedback, subscription management, and data persistence.

## Tech Stack Recommendations

- **Framework**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with refresh token strategy
- **AI Integration**: OpenAI API or similar for feedback generation
- **File Storage**: AWS S3 or similar for audio recordings
- **Payment Processing**: Stripe for subscription management
- **Environment**: Docker containerization recommended

## Database Schema Design

### User Model
```javascript
const userSchema = {
  _id: ObjectId,
  email: String, // unique, required
  phone: String,
  firstName: String, // required
  lastName: String, // required
  password: String, // hashed with bcrypt
  emailVerified: Boolean, // default: false
  refreshToken: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Test Preferences Model
```javascript
const testPreferencesSchema = {
  _id: ObjectId,
  userId: ObjectId, // ref: User
  testDate: String, // ISO date string
  targetBand: String, // "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"
  timeFrame: String, // "1-month", "2-months", "3-months", "6-months"
  createdAt: Date,
  updatedAt: Date
}
```

### Subscription Model
```javascript
const subscriptionSchema = {
  _id: ObjectId,
  userId: ObjectId, // ref: User
  planType: String, // enum: ["free", "premium", "pro"]
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  subscriptionDate: Date,
  trialEndsAt: Date,
  isTrialActive: Boolean,
  status: String, // enum: ["active", "canceled", "past_due", "incomplete"]
  createdAt: Date,
  updatedAt: Date
}
```

### Usage Tracking Model
```javascript
const usageSchema = {
  _id: ObjectId,
  userId: ObjectId, // ref: User
  practiceCount: Number, // default: 0
  testCount: Number, // default: 0
  lastReset: Date, // monthly reset tracking
  monthlyHistory: [{
    month: String, // "2024-01"
    practiceCount: Number,
    testCount: Number
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Practice Session Model
```javascript
const practiceSessionSchema = {
  _id: ObjectId,
  userId: ObjectId, // ref: User
  topicId: String, // matches frontend topic IDs
  question: String,
  userResponse: String,
  audioFileUrl: String, // optional: S3 URL for audio recording
  feedback: {
    overallScore: Number, // 1-9 IELTS band score
    pronunciation: Number,
    fluency: Number,
    vocabulary: Number,
    grammar: Number,
    coherence: Number,
    detailedFeedback: String,
    improvements: [String],
    strengths: [String]
  },
  timeSpent: Number, // seconds
  completed: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Test Simulation Model
```javascript
const testSimulationSchema = {
  _id: ObjectId,
  userId: ObjectId, // ref: User
  parts: [{
    partNumber: Number, // 1, 2, or 3
    question: String,
    userResponse: String,
    audioFileUrl: String, // optional
    timeSpent: Number // seconds
  }],
  overallFeedback: {
    totalScore: Number, // overall band score
    partScores: [{
      part: Number,
      score: Number,
      feedback: String
    }],
    strengths: [String],
    improvements: [String],
    detailedAnalysis: String
  },
  completed: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Topics Model (Admin managed)
```javascript
const topicSchema = {
  _id: ObjectId,
  topicId: String, // unique identifier matching frontend
  title: String,
  description: String,
  part: Number, // 1, 2, or 3
  category: String,
  difficulty: String, // enum: ["beginner", "intermediate", "advanced"]
  questions: [{
    question: String,
    timeLimit: Number, // seconds
    tips: [String]
  }],
  isActive: Boolean, // for admin to enable/disable topics
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints Specification

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "phone": "+1234567890",
  "firstName": "John",
  "lastName": "Doe",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "user": {
    "id": "64a5f8c2b1234567890abcde",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false
  }
}
```

#### POST /api/auth/login
Authenticate user and return tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "64a5f8c2b1234567890abcde",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /api/auth/logout
Invalidate user tokens.

**Headers:** `Authorization: Bearer <token>`

### User Management Endpoints

#### GET /api/users/profile
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "64a5f8c2b1234567890abcde",
    "email": "user@example.com",
    "phone": "+1234567890",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### PUT /api/users/profile
Update user profile information.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567890"
}
```

### Test Preferences Endpoints

#### GET /api/users/preferences
Get user's test preferences.

**Headers:** `Authorization: Bearer <token>`

#### POST /api/users/preferences
Create or update test preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "testDate": "2024-06-15T00:00:00.000Z",
  "targetBand": "7.5",
  "timeFrame": "3-months"
}
```

### Topics Endpoints

#### GET /api/topics
Get all available practice topics.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "topics": [
    {
      "id": "hometown",
      "title": "Your Hometown",
      "description": "Talk about where you're from...",
      "part": 1,
      "category": "Personal Information",
      "difficulty": "beginner",
      "questions": [
        {
          "question": "Let's talk about your hometown...",
          "timeLimit": 120,
          "tips": ["Give specific details...", "Mention what you like..."]
        }
      ]
    }
  ]
}
```

### Practice Session Endpoints

#### POST /api/practice/sessions
Start a new practice session.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "topicId": "hometown",
  "question": "Let's talk about your hometown..."
}
```

#### PUT /api/practice/sessions/:sessionId
Complete a practice session with user response.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userResponse": "I come from a small town in northern Italy...",
  "timeSpent": 105,
  "audioFile": "optional base64 encoded audio or multipart upload"
}
```

**Response (200):**
```json
{
  "success": true,
  "session": {
    "id": "64a5f8c2b1234567890abcde",
    "feedback": {
      "overallScore": 7.0,
      "pronunciation": 7.5,
      "fluency": 6.5,
      "vocabulary": 7.0,
      "grammar": 7.0,
      "coherence": 7.5,
      "detailedFeedback": "Your response demonstrates good fluency...",
      "improvements": ["Work on reducing hesitation", "Expand vocabulary"],
      "strengths": ["Clear pronunciation", "Good structure"]
    }
  }
}
```

#### GET /api/practice/sessions
Get user's practice session history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Number of sessions to return (default: 10)
- `offset`: Number of sessions to skip (default: 0)
- `topicId`: Filter by specific topic (optional)

### Test Simulation Endpoints

#### POST /api/tests/simulations
Start a new test simulation.

**Headers:** `Authorization: Bearer <token>`

**Response (201):**
```json
{
  "success": true,
  "simulation": {
    "id": "64a5f8c2b1234567890abcde",
    "parts": [
      {
        "partNumber": 1,
        "question": "Let's talk about your hometown...",
        "timeLimit": 300
      },
      {
        "partNumber": 2,
        "question": "Describe a memorable event...",
        "timeLimit": 240
      },
      {
        "partNumber": 3,
        "question": "How has technology changed...",
        "timeLimit": 300
      }
    ]
  }
}
```

#### PUT /api/tests/simulations/:simulationId
Complete test simulation with all responses.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "parts": [
    {
      "partNumber": 1,
      "userResponse": "I come from...",
      "timeSpent": 120
    },
    {
      "partNumber": 2,
      "userResponse": "One memorable event...",
      "timeSpent": 180
    },
    {
      "partNumber": 3,
      "userResponse": "Technology has significantly...",
      "timeSpent": 200
    }
  ]
}
```

### Subscription Management Endpoints

#### GET /api/subscriptions/current
Get current user subscription status.

**Headers:** `Authorization: Bearer <token>`

#### POST /api/subscriptions/checkout
Create Stripe checkout session for subscription.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "planType": "premium"
}
```

#### POST /api/subscriptions/webhook
Stripe webhook endpoint for subscription events.

**Headers:** `Stripe-Signature: <signature>`

### Usage Tracking Endpoints

#### GET /api/usage/current
Get current month usage statistics.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "usage": {
    "practiceCount": 15,
    "testCount": 2,
    "limits": {
      "practiceLimit": 20,
      "testLimit": 5
    },
    "resetDate": "2024-02-01T00:00:00.000Z"
  }
}
```

## Authentication & Authorization

### JWT Token Strategy
- **Access Token**: Short-lived (15 minutes), contains user ID and basic info
- **Refresh Token**: Long-lived (7 days), stored in database for validation
- **Token Rotation**: New refresh token issued on each refresh

### Authorization Levels
- **Free Users**: Limited practice sessions and tests
- **Premium Users**: Unlimited practice, advanced feedback
- **Pro Users**: All features plus priority support

### Rate Limiting
- Authentication endpoints: 5 requests per minute per IP
- API endpoints: 100 requests per minute per user
- File upload: 10 requests per minute per user

## AI Integration Guidelines

### OpenAI Integration
- Use GPT-4 for detailed feedback generation
- Implement prompt engineering for IELTS-specific evaluation
- Cache common responses to reduce API costs
- Implement fallback for API failures

### Feedback Generation Prompt Example
```
You are an IELTS Speaking examiner. Evaluate this response for a Part 1 question:

Question: "Let's talk about your hometown. Can you describe where you're from?"
Response: "{userResponse}"
Target Band: {targetBand}

Provide scores (1-9) for:
- Pronunciation
- Fluency and Coherence  
- Lexical Resource
- Grammatical Range and Accuracy

Include specific feedback and improvement suggestions.
```

## File Storage Strategy

### Audio Recording Storage
- Use AWS S3 or similar cloud storage
- Implement pre-signed URLs for secure uploads
- Audio format: MP3 or WebM
- Maximum file size: 50MB
- Automatic cleanup of old recordings (30 days)

### File Organization
```
/audio-recordings/
  /{userId}/
    /practice/
      /{sessionId}.mp3
    /tests/
      /{simulationId}-part{number}.mp3
```

## Security Considerations

### Data Protection
- Hash passwords using bcrypt (12+ rounds)
- Validate and sanitize all input data
- Implement CORS policies
- Use HTTPS in production
- Regular security audits

### Privacy Compliance
- GDPR compliance for EU users
- Data retention policies
- User data deletion capabilities
- Privacy policy enforcement

## Environment Configuration

### Required Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/ielts-practice
MONGODB_TEST_URI=mongodb://localhost:27017/ielts-practice-test

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=ielts-audio-recordings

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Service (SendGrid/SES)
EMAIL_SERVICE_API_KEY=your-email-service-key
FROM_EMAIL=noreply@ielts-practice.com

# Redis (for caching and rate limiting)
REDIS_URL=redis://localhost:6379

# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Testing Strategy

### Unit Tests
- Model validation tests
- Service layer tests
- Utility function tests
- Authentication middleware tests

### Integration Tests
- API endpoint tests
- Database integration tests
- Third-party service mocks
- File upload tests

### E2E Tests
- Complete user registration flow
- Practice session workflow
- Subscription management flow
- Test simulation process

## Deployment Guidelines

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database indexes created
- [ ] SSL certificates installed
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented
- [ ] Load balancing configured
- [ ] CDN setup for static assets

## Monitoring & Analytics

### Key Metrics to Track
- User registration and retention rates
- Practice session completion rates
- API response times and error rates
- Subscription conversion rates
- AI feedback generation costs

### Logging Strategy
- Structured logging with Winston
- Error tracking with Sentry
- Performance monitoring with New Relic
- User analytics with Mixpanel

## API Versioning

### Versioning Strategy
- URL versioning: `/api/v1/`, `/api/v2/`
- Maintain backward compatibility for 6 months
- Clear deprecation notices and migration guides

This integration guide provides a comprehensive foundation for developing the backend API that will seamlessly integrate with your IELTS Speaking Practice frontend application.