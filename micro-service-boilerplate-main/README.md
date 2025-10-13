# micro-service-boilerplate

Express.js TypeScript microservice boilerplate with RabbitMQ, MongoDB, comprehensive testing, and standardized response patterns

## Overview

This is a comprehensive Express.js microservice boilerplate built with TypeScript, featuring:

- **RabbitMQ Integration**: Message queue processing with encryption support
- **MongoDB Integration**: Database connectivity with Mongoose ODM
- **Comprehensive Testing**: Jest test suite with extensive coverage
- **Standardized Responses**: Consistent API response formatting
- **Error Handling**: Centralized error management with custom error types
- **Logging**: Winston-based logging with contextual information
- **Dependency Injection**: TypeDI for clean architecture
- **Environment Configuration**: Centralized config management
- **Rate Limiting**: Built-in request rate limiting
- **CORS Support**: Configurable cross-origin resource sharing
- **Health Checks**: `/v1/health` exposes liveness, readiness (MongoDB, RabbitMQ, optional cache) and diagnostics toggled via env
