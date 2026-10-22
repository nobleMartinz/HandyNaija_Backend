# API Contract

## Base URL
`https://api.handynaija.com/api/v1`

## Authentication
All protected endpoints require a JWT access token in the Authorization header:
`Authorization: Bearer <access_token>`

## Response Format
```json
{
  "success": true,
  "message": "Operation completed",
  "data": {},
  "statusCode": 200
}
```

## Auth Endpoints

### POST /auth/register/customer
Register a new customer account.
```json
{
  "email": "customer@example.com",
  "phone": "+2348012345678",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

### POST /auth/register/provider
Register a new provider account.
```json
{
  "email": "provider@example.com",
  "phone": "+2348012345678",
  "password": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "business_name": "Janes Services",
  "bio": "Professional electrician with 10 years experience"
}
```

### POST /auth/login
Login user.
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### POST /auth/refresh
Refresh access token using refresh token cookie.

### POST /auth/logout
Logout user and clear refresh token cookie.

### POST /auth/forgot-password
Request password reset email.

### POST /auth/reset-password
Reset password using token from email.

## User Endpoints

### GET /users/me
Get current user profile.

### PUT /users/profile
Update user profile.

### PUT /users/change-password
Change user password.

### GET /users/notifications
Get user notifications.

### PUT /users/notifications/:id/read
Mark notification as read.

## Provider Endpoints

### GET /providers/search
Search providers by category, location, rating.

### GET /providers/:id
Get provider profile.

### PUT /providers/profile
Update provider profile.

### GET /providers/services
Get providers services.

### POST /providers/services
Create new service.

### PUT /providers/services/:id
Update service.

### DELETE /providers/services/:id
Delete service.

### GET /providers/availability
Get provider availability schedule.

### PUT /providers/availability
Update availability schedule.

### GET /providers/dashboard/stats
Get provider dashboard statistics.

## Service Endpoints

### GET /services/categories
Get all service categories.

### GET /services/categories/:id
Get category by ID.

### POST /services/categories
Create category (admin only).

### PUT /services/categories/:id
Update category (admin only).

### DELETE /services/categories/:id
Delete category (admin only).

## Request Endpoints

### POST /requests
Create new service request.

### GET /requests
Get user requests.

### GET /requests/:id
Get request details.

### DELETE /requests/:id
Cancel request.

### POST /requests/:id/messages
Send message to provider.

### GET /requests/:id/messages
Get request messages.

### POST /requests/:id/accept
Provider accept request.

### POST /requests/:id/reject
Provider reject request.

### POST /requests/:id/reschedule
Reschedule request.

### PUT /requests/:id/status
Update request status (provider).

## Message Endpoints

### GET /messages/conversations
Get user conversations.

### GET /messages/conversations/:id
Get conversation messages.

### POST /messages/conversations/:id
Send message.

### PUT /messages/conversations/:id/read
Mark messages as read.

## Review Endpoints

### POST /reviews
Submit review for completed request.

### GET /reviews/provider/:providerId
Get provider reviews.

### GET /reviews/request/:requestId
Get review for request.

### PUT /reviews/:id/moderate
Moderate review (admin only).

## Admin Endpoints

### GET /admin/dashboard
Get admin dashboard statistics.

### GET /admin/users
Get all users with filters.

### PUT /admin/users/:id
Update user (admin only).

### GET /admin/providers
Get all providers with filters.

### PUT /admin/providers/:id/verify
Verify provider (admin only).

### GET /admin/requests
Get all requests with filters.

### GET /admin/reviews
Get all reviews for moderation.

### GET /admin/reports
Get system reports.

## Error Codes
- 400: Bad Request (validation error)
- 401: Unauthorized (authentication required)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (resource exists)
- 429: Too Many Requests
- 500: Internal Server Error
