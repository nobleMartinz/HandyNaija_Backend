# HandyNaija Backend API

A robust REST API for the HandyNaija Local Service Marketplace built with Node.js, Express, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control (Customer, Provider, Admin)
- **Provider Management**: Profiles, services, availability, verification
- **Service Requests**: Full lifecycle (pending → accepted → scheduled → in_progress → completed)
- **Real-time Messaging**: Request-linked conversations between customers and providers
- **Reviews & Ratings**: 1-5 star ratings with moderation
- **Admin Dashboard**: User management, provider verification, reports, analytics
- **Notifications**: In-app and email notifications
- **Security**: Helmet, CORS, rate limiting, input validation, password hashing

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Security**: helmet, cors, bcryptjs, express-rate-limit

## Project Structure

```
backend/
├── src/
│   ├── config/         # Database, environment configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, validation, error handling, rate limiting
│   ├── models/         # Data models (if using ORM)
│   ├── repositories/   # Data access layer
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions, error classes, API response
│   ├── validators/     # Custom validators
│   └── server.js       # Application entry point
├── migrations/         # Database migrations
├── tests/              # Test files
├── .env.example        # Environment variables template
├── package.json
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=handynaija
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d

# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Database Setup

```bash
# Run migrations
npm run migrate
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register/customer` - Register customer
- `POST /api/v1/auth/register/provider` - Register provider
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/me` - Get current user

### Users
- `GET /api/v1/users/profile` - Get profile
- `PATCH /api/v1/users/profile` - Update profile
- `PATCH /api/v1/users/password` - Change password
- `GET /api/v1/users/notifications` - Get notifications
- `PATCH /api/v1/users/notifications/:id/read` - Mark notification read
- `PATCH /api/v1/users/notifications/read-all` - Mark all read

### Providers (Public)
- `GET /api/v1/providers` - Search providers
- `GET /api/v1/providers/:id` - Get provider profile
- `GET /api/v1/providers/:id/services` - Get provider services
- `GET /api/v1/providers/:id/availability` - Get provider availability
- `GET /api/v1/providers/:id/reviews` - Get provider reviews

### Providers (Authenticated)
- `POST /api/v1/providers/profile` - Create provider profile
- `PATCH /api/v1/providers/profile` - Update profile
- `POST /api/v1/providers/services` - Add service
- `PATCH /api/v1/providers/services/:id` - Update service
- `DELETE /api/v1/providers/services/:id` - Delete service
- `PUT /api/v1/providers/availability` - Update availability
- `GET /api/v1/providers/dashboard/stats` - Dashboard statistics

### Services (Categories)
- `GET /api/v1/services` - List categories
- `GET /api/v1/services/:id` - Get category
- `POST /api/v1/services` - Create category (Admin)
- `PATCH /api/v1/services/:id` - Update category (Admin)
- `DELETE /api/v1/services/:id` - Delete category (Admin)

### Service Requests
- `POST /api/v1/requests` - Create request (Customer)
- `GET /api/v1/requests` - Get my requests
- `GET /api/v1/requests/:id` - Get request details
- `PATCH /api/v1/requests/:id/cancel` - Cancel request (Customer)
- `GET /api/v1/requests/:id/messages` - Get request messages
- `POST /api/v1/requests/:id/messages` - Send message

### Provider Request Actions
- `GET /api/v1/requests/provider/requests` - Get provider requests
- `PATCH /api/v1/requests/provider/requests/:id/accept` - Accept request
- `PATCH /api/v1/requests/provider/requests/:id/reject` - Reject request
- `PATCH /api/v1/requests/provider/requests/:id/reschedule` - Propose new time
- `PATCH /api/v1/requests/provider/requests/:id/status` - Update status

### Messages
- `GET /api/v1/messages/conversations` - Get conversations
- `GET /api/v1/messages/conversations/:id` - Get conversation
- `POST /api/v1/messages/conversations/:id/messages` - Send message
- `PATCH /api/v1/messages/conversations/:id/read` - Mark as read

### Reviews
- `GET /api/v1/reviews/provider/:providerId` - Get provider reviews
- `POST /api/v1/reviews/request/:requestId` - Submit review (Customer)
- `GET /api/v1/reviews/my-reviews` - Get my reviews
- `PATCH /api/v1/reviews/:id/moderate` - Moderate review (Admin)

### Admin
- `GET /api/v1/admin/dashboard` - Dashboard stats
- `GET /api/v1/admin/users` - Manage users
- `PATCH /api/v1/admin/users/:id/status` - Update user status
- `GET /api/v1/admin/providers` - Manage providers
- `PATCH /api/v1/admin/providers/:id/verify` - Verify provider
- `PATCH /api/v1/admin/providers/:id/status` - Update provider status
- `GET /api/v1/admin/requests` - Monitor requests
- `GET /api/v1/admin/reviews` - Moderate reviews
- `GET /api/v1/admin/reports` - Manage reports
- `PATCH /api/v1/admin/reports/:id` - Update report

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "statusCode": 200
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [...],
  "statusCode": 400
}
```

## Request Status Flow

```
PENDING → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED
    │
    ├── REJECTED
    └── CANCELLED
```

## Provider Verification Status

- `unverified` - Default, newly registered
- `verified` - Admin verified identity/business
- `trusted` - High-performing, verified providers

## Testing

```bash
npm test
```

## License

MIT