# IELTS Speaking Practice API - Testing Guide

## Overview

This guide provides instructions for setting up and testing the IELTS Speaking Practice API using the provided Postman and Insomnia collections.

## Prerequisites

1. **Backend Server**: Ensure the backend server is running on `http://localhost:3000` (or update the base URL in environment variables)
2. **MongoDB**: Database should be accessible and properly configured
3. **API Testing Tool**: Either Postman or Insomnia installed on your machine

## Collection Files

- **Postman Collection**: `IELTS-Practice-API.postman_collection.json`
- **Insomnia Collection**: `insomnia-collection.json`
- **Environment Variables**: Configured within each collection

## Setup Instructions

### Postman Setup

1. **Import Collection**:
   - Open Postman
   - Click "Import" button
   - Select the `IELTS-Practice-API.postman_collection.json` file
   - The collection will be imported with all requests organized in folders

2. **Environment Variables**:
   - The collection includes environment variables:
     - `base_url`: `http://localhost:3000`
     - `test_email`: `test@example.com`
     - `test_password`: `TestPassword123!`
   - Variables are automatically set during testing:
     - `access_token`: Set after successful login
     - `refresh_token`: Set after successful login
     - `user_id`: Set after successful login
     - `practice_session_id`: Set after starting practice session
     - `test_simulation_id`: Set after starting test simulation

3. **Global Scripts**:
   - Pre-request scripts handle token refresh if needed
   - Test scripts validate responses and extract tokens automatically

### Insomnia Setup

1. **Import Collection**:
   - Open Insomnia
   - Go to Application → Preferences → Data
   - Click "Import Data"
   - Select the `insomnia-collection.json` file
   - Choose "Import" to add all requests

2. **Environment Variables**:
   - Environment is automatically created with the collection
   - Variables are organized in the "Base Environment"
   - Update values as needed for your testing environment

## Testing Workflow

### 1. User Registration and Authentication

```
1. Register User         → Creates new user account
2. Login User           → Gets access and refresh tokens
3. Refresh Token        → Refreshes access token (optional)
4. Get User Profile     → Verifies authentication works
```

**Expected Flow**:
- Register returns user data without tokens
- Login returns both user data and tokens
- Tokens are automatically stored for subsequent requests

### 2. User Profile and Preferences

```
1. Get User Profile     → Retrieve current user info
2. Update User Profile  → Modify user details
3. Get Test Preferences → Retrieve IELTS goals (may be empty initially)
4. Create/Update Test Preferences → Set target band, test date, etc.
```

### 3. Practice Session Flow

```
1. Get All Topics       → Retrieve available practice topics
2. Start Practice Session → Initialize session with specific topic
3. Complete Practice Session → Submit response and get AI feedback
4. Get Practice History → View previous sessions
```

**Expected Results**:
- Topics include different parts (1, 2, 3) and difficulty levels
- Practice session returns comprehensive feedback with band scores
- History shows all completed sessions with timestamps

### 4. Test Simulation Flow

```
1. Start Test Simulation → Creates full test with all 3 parts
2. Complete Test Simulation → Submit all responses at once
3. Get Test History → View previous test results
```

**Expected Results**:
- Test simulation includes questions for Parts 1, 2, and 3
- Comprehensive feedback with overall band score and part-specific scores
- Detailed analysis and improvement suggestions

### 5. Subscription and Usage Management

```
1. Get Current Subscription → Check current plan status
2. Create Checkout Session → Generate Stripe payment URL
3. Get Current Usage → Check monthly usage against limits
4. Get Usage History → View historical usage data
```

## Environment Variables Reference

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `base_url` | Backend server URL | `http://localhost:3000` |
| `test_email` | Test user email | `test@example.com` |
| `test_password` | Test user password | `TestPassword123!` |
| `access_token` | JWT access token | Auto-set after login |
| `refresh_token` | JWT refresh token | Auto-set after login |
| `user_id` | Current user ID | Auto-set after login |
| `practice_session_id` | Current practice session | Auto-set after starting session |
| `test_simulation_id` | Current test simulation | Auto-set after starting test |

## Test Scenarios

### Happy Path Testing

1. **Complete User Journey**:
   ```
   Register → Login → Set Preferences → Practice → Get Feedback → Take Test → View Results
   ```

2. **Subscription Upgrade Flow**:
   ```
   Login → Check Usage → Hit Limits → Create Checkout → Upgrade → Access Premium Features
   ```

### Error Handling Testing

1. **Authentication Errors**:
   - Invalid credentials
   - Expired tokens
   - Missing authorization headers

2. **Validation Errors**:
   - Invalid email formats
   - Weak passwords
   - Invalid preference values

3. **Usage Limit Errors**:
   - Exceeding practice limits
   - Exceeding test limits
   - Free user accessing premium features

### Performance Testing

1. **Response Time Validation**:
   - All requests should complete within 5 seconds
   - Login/register should be under 1 second
   - AI feedback generation may take 10-30 seconds

2. **Concurrent User Testing**:
   - Multiple users practicing simultaneously
   - Database connection handling
   - Rate limiting effectiveness

## Automated Testing

### Postman Test Scripts

Each request includes test scripts that automatically verify:
- HTTP status codes
- Response structure and required fields
- Data type validation
- Token extraction and storage

### Running Collection Tests

1. **Using Postman Runner**:
   - Select the entire collection
   - Choose environment
   - Click "Run" to execute all tests sequentially
   - View detailed test results

2. **Using Newman (CLI)**:
   ```bash
   npm install -g newman
   newman run IELTS-Practice-API.postman_collection.json
   ```

## Common Issues and Troubleshooting

### Authentication Issues

**Problem**: "Unauthorized" errors despite login
**Solution**: Check if access token is properly set and not expired

**Problem**: Token refresh not working
**Solution**: Verify refresh token is valid and properly configured

### Database Connection Issues

**Problem**: "Database connection failed" errors
**Solution**: Ensure MongoDB is running and connection string is correct

### AI Integration Issues

**Problem**: Practice/test feedback generation fails
**Solution**: Verify OpenAI API key is configured and has sufficient credits

### Rate Limiting Issues

**Problem**: "Too many requests" errors
**Solution**: Implement delays between requests or increase rate limits

## Mock Data for Testing

### Sample User Registration Data
```json
{
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePassword123!"
}
```

### Sample Test Preferences
```json
{
  "testDate": "2024-06-15T00:00:00.000Z",
  "targetBand": "7.5",
  "timeFrame": "3-months"
}
```

### Sample Practice Response
```json
{
  "userResponse": "I come from Milan, Italy. It's a vibrant city known for fashion and business. What makes it special is the perfect blend of historical architecture like the Duomo cathedral and modern skyscrapers in the business district. The city has excellent public transportation and a thriving cultural scene with world-class museums and theaters.",
  "timeSpent": 95
}
```

## API Documentation Integration

Both collections can be used to generate API documentation:

1. **Postman Documentation**: 
   - Use Postman's built-in documentation generator
   - Publish to Postman's public documentation platform

2. **OpenAPI/Swagger Integration**:
   - Export collection to OpenAPI format
   - Generate interactive documentation with Swagger UI

## Monitoring and Logging

When testing, monitor the following:

1. **Server Logs**: Watch for errors, warnings, and performance metrics
2. **Database Queries**: Monitor query performance and connection usage
3. **Third-party API Calls**: Track OpenAI API usage and costs
4. **Memory/CPU Usage**: Ensure server resources are sufficient

## Security Testing

### Authentication Security
- Test password hashing strength
- Verify JWT token expiration handling
- Check for token leakage in logs

### Input Validation
- Test SQL injection attempts
- Verify XSS prevention
- Check file upload security (for audio files)

### Rate Limiting
- Verify rate limits prevent abuse
- Test different rate limit scenarios
- Ensure legitimate users aren't blocked

This comprehensive testing guide ensures thorough validation of the IELTS Speaking Practice API across all features and edge cases.