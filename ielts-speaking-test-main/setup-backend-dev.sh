#!/bin/bash

# IELTS Speaking Practice Backend Setup Script
# This script helps set up the development environment for the backend API

echo "🎯 IELTS Speaking Practice Backend Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js found: $NODE_VERSION"
        if [[ ${NODE_VERSION:1:2} -lt 16 ]]; then
            print_warning "Node.js version should be 16 or higher for best compatibility"
        fi
    else
        print_error "Node.js not found. Please install Node.js 16 or higher"
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
}

# Check if MongoDB is available
check_mongodb() {
    if command -v mongod &> /dev/null; then
        print_status "MongoDB found locally"
    elif command -v docker &> /dev/null; then
        print_info "MongoDB not found locally, but Docker is available for containerized setup"
    else
        print_warning "MongoDB not found. You'll need MongoDB running for the backend"
        echo "Options:"
        echo "1. Install MongoDB locally: https://docs.mongodb.com/manual/installation/"
        echo "2. Use MongoDB Atlas (cloud): https://www.mongodb.com/atlas"
        echo "3. Use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"
    fi
}

# Create project structure
create_structure() {
    print_info "Creating backend project structure..."
    
    # Create main directories
    mkdir -p backend/{src,tests,docs,scripts}
    mkdir -p backend/src/{models,routes,controllers,middleware,services,utils,config}
    mkdir -p backend/tests/{unit,integration,e2e}
    
    print_status "Directory structure created"
}

# Create package.json
create_package_json() {
    print_info "Creating package.json..."
    
    cat > backend/package.json << 'EOF'
{
  "name": "ielts-speaking-practice-api",
  "version": "1.0.0",
  "description": "Backend API for IELTS Speaking Practice application",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "docs": "swagger-jsdoc -d swagger.config.js src/routes/*.js -o docs/swagger.json"
  },
  "keywords": ["ielts", "speaking", "practice", "api", "education"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "multer": "^1.4.5-lts.1",
    "aws-sdk": "^2.1508.0",
    "stripe": "^14.7.0",
    "openai": "^4.20.1",
    "nodemailer": "^6.9.7",
    "redis": "^4.6.11",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "eslint": "^8.55.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-import": "^2.29.0",
    "@types/jest": "^29.5.8",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF
    
    print_status "package.json created"
}

# Create environment template
create_env_template() {
    print_info "Creating environment template..."
    
    cat > backend/.env.example << 'EOF'
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ielts-practice
MONGODB_TEST_URI=mongodb://localhost:27017/ielts-practice-test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-token-secret-key-change-this-too
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# AWS S3 Configuration (for audio file storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=ielts-audio-recordings

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Configuration (SendGrid example)
EMAIL_SERVICE_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@ielts-practice.com

# Redis Configuration (for caching and rate limiting)
REDIS_URL=redis://localhost:6379

# Application Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
EOF
    
    cat > backend/.env << 'EOF'
# Copy from .env.example and fill in your actual values
MONGODB_URI=mongodb://localhost:27017/ielts-practice
JWT_SECRET=development-jwt-secret-change-in-production
JWT_REFRESH_SECRET=development-refresh-secret-change-in-production
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=your-openai-key-here
FRONTEND_URL=http://localhost:5173
EOF
    
    print_status "Environment templates created"
    print_warning "Remember to update .env with your actual API keys and secrets!"
}

# Create basic server structure
create_server_files() {
    print_info "Creating basic server files..."
    
    # Main server file
    cat > backend/src/server.js << 'EOF'
const app = require('./app');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;
EOF

    # App configuration
    cat > backend/src/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/practice', require('./routes/practice'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/usage', require('./routes/usage'));

// Error handling middleware
app.use((err, req, res, next) => {
  const logger = require('./utils/logger');
  logger.error(err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = app;
EOF

    # Database connection
    mkdir -p backend/src/config
    cat > backend/src/config/database.js << 'EOF'
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
EOF

    # Logger utility
    mkdir -p backend/src/utils
    cat > backend/src/utils/logger.js << 'EOF'
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ielts-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
EOF

    # Create placeholder route files
    mkdir -p backend/src/routes
    for route in auth users topics practice tests subscriptions usage; do
        cat > backend/src/routes/${route}.js << EOF
const express = require('express');
const router = express.Router();

// TODO: Implement ${route} routes
router.get('/', (req, res) => {
  res.json({ message: '${route} routes - coming soon' });
});

module.exports = router;
EOF
    done
    
    print_status "Basic server files created"
}

# Create Docker setup
create_docker_setup() {
    print_info "Creating Docker configuration..."
    
    cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
EOF

    cat > backend/docker-compose.yml << 'EOF'
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongodb:27017/ielts-practice
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  mongodb_data:
EOF
    
    print_status "Docker configuration created"
}

# Create README
create_readme() {
    print_info "Creating README.md..."
    
    cat > backend/README.md << 'EOF'
# IELTS Speaking Practice API

Backend API for the IELTS Speaking Practice application, providing user management, practice sessions, AI-powered feedback, and subscription management.

## Features

- User authentication with JWT tokens
- Practice session management with AI feedback
- Full IELTS test simulations
- Subscription and payment processing
- Usage tracking and limits
- Audio file storage and processing
- RESTful API design with comprehensive documentation

## Quick Start

### Prerequisites

- Node.js 16 or higher
- MongoDB 5.0 or higher
- Redis (optional, for caching)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment template:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration values

5. Start the development server:
   ```bash
   npm run dev
   ```

### Using Docker

```bash
docker-compose up -d
```

## API Documentation

- Development: http://localhost:3000/api-docs
- Integration guide: See `../backend-integration.md`
- Postman collection: `../IELTS-Practice-API.postman_collection.json`

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Environment Variables

See `.env.example` for all available configuration options.

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Utility functions
```

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Submit pull requests for review

## License

MIT
EOF
    
    print_status "README.md created"
}

# Main setup function
main() {
    echo
    print_info "Starting backend setup process..."
    echo
    
    # Run all setup steps
    check_node
    check_mongodb
    create_structure
    create_package_json
    create_env_template
    create_server_files
    create_docker_setup
    create_readme
    
    echo
    print_status "Backend setup complete!"
    echo
    echo "Next steps:"
    echo "1. cd backend"
    echo "2. npm install"
    echo "3. Update .env with your API keys"
    echo "4. npm run dev"
    echo
    print_info "For API testing, use the provided Postman/Insomnia collections"
    print_info "Refer to backend-integration.md for detailed implementation guidance"
    echo
}

# Run main function
main "$@"