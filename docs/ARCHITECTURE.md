# Technical Architecture

## Overview
HandyNaija is a local service marketplace platform connecting customers with service providers in Nigeria. The system follows a modular monolith architecture with layered design patterns.

## Architecture Diagram
```
Client (React Web) ? API Gateway ? Backend (Node.js/Express)
                                        ?
                              PostgreSQL Database
                                        ?
                              Redis (Caching)
                                        ?
                              External Services (Flutterwave, SendGrid, Firebase)
```

## Backend Architecture

### Layered Architecture
1. **Routes Layer** - HTTP request handling and routing
2. **Controller Layer** - Request validation and response formatting
3. **Service Layer** - Business logic and orchestration
4. **Model/Data Layer** - Database operations and data access

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM/Query Builder**: pg (native driver)
- **Authentication**: JWT (Access + Refresh tokens)
- **Validation**: express-validator
- **Security**: bcrypt, helmet, cors, rate-limiting
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI
- **Monitoring**: Winston logging, Sentry error tracking

## Database Design

### Tables (15 total)
1. **users** - Customer and provider accounts
2. **providers** - Provider profiles and business info
3. **service_categories** - Service categories (13 default)
4. **services** - Provider service listings
5. **requests** - Customer service requests
6. **messages** - In-app messaging
7. **conversations** - Message threads
8. **reviews** - Customer reviews of providers
9. **payments** - Transaction records
10. **notifications** - User notifications
11. **admin_users** - Admin accounts
12. **audit_logs** - System audit trail
13. **provider_availability** - Provider schedules
14. **password_resets** - Password reset tokens
15. **refresh_tokens** - JWT refresh tokens

### Indexing Strategy
- Primary keys on all tables
- Foreign keys with indexes
- Composite indexes for common query patterns
- Partial indexes for active records only

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP methods for actions
- JSON request/response
- Consistent error handling
- Versioned endpoints (/api/v1/)

### Response Format
```json
{
  "success": true,
  "message": "Operation completed",
  "data": {},
  "statusCode": 200
}
```

### Error Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": [],
  "statusCode": 400
}
```

## Security Architecture

### Authentication Flow
1. User login ? JWT access token (15min) + refresh token (7 days)
2. Access token in Authorization header
3. Refresh token in httpOnly cookie
4. Token rotation on refresh

### Authorization
- Role-based access control (customer, provider, admin)
- Resource-level permissions
- Middleware-based checks

### Data Protection
- Password hashing with bcrypt (12 rounds)
- Sensitive data encryption at rest
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention
- CSRF protection

## Performance Architecture

### Caching Strategy
- Redis for session storage
- Database query result caching
- Static asset CDN
- Gzip compression

### Database Optimization
- Connection pooling
- Query optimization
- Read replicas (post-MVP)
- Partitioning for large tables

## Deployment Architecture

### Environments
- Development (Docker containers)
- Staging (AWS ECS)
- Production (AWS ECS with auto-scaling)

### CI/CD Pipeline
- GitHub Actions for automated testing
- Docker image building
- Blue-green deployment
- Automated rollbacks

## Monitoring & Logging

### Logging
- Winston for structured logging
- Request/response logging
- Error tracking with Sentry
- Audit trail storage

### Metrics
- Request latency
- Error rates
- Database performance
- User activity tracking
