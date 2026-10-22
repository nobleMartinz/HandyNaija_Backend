# Database Schema Documentation

## Overview
HandyNaija uses PostgreSQL as its primary database. The schema consists of 15 tables designed for a service marketplace platform.

## Tables

### users
- id (SERIAL PK)
- email (VARCHAR, UNIQUE)
- phone (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- first_name (VARCHAR)
- last_name (VARCHAR)
- avatar_url (VARCHAR)
- role (ENUM: customer, provider, admin)
- is_verified (BOOLEAN)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### providers
- id (SERIAL PK)
- user_id (FK ? users.id)
- business_name (VARCHAR)
- bio (TEXT)
- category_ids (ARRAY)
- rating (DECIMAL)
- total_reviews (INT)
- is_available (BOOLEAN)
- verification_status (ENUM)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### service_categories
- id (SERIAL PK)
- name (VARCHAR, UNIQUE)
- description (TEXT)
- icon_url (VARCHAR)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

### services
- id (SERIAL PK)
- provider_id (FK ? providers.id)
- category_id (FK ? service_categories.id)
- title (VARCHAR)
- description (TEXT)
- price (DECIMAL)
- price_type (ENUM)
- images (ARRAY)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### requests
- id (SERIAL PK)
- customer_id (FK ? users.id)
- provider_id (FK ? providers.id)
- category_id (FK ? service_categories.id)
- title (VARCHAR)
- description (TEXT)
- budget (DECIMAL)
- status (ENUM: pending, accepted, scheduled, in_progress, completed, rejected, cancelled)
- scheduled_at (TIMESTAMP)
- address (TEXT)
- latitude (DECIMAL)
- longitude (DECIMAL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### conversations
- id (SERIAL PK)
- request_id (FK ? requests.id)
- customer_id (FK ? users.id)
- provider_id (FK ? providers.id)
- last_message_at (TIMESTAMP)
- created_at (TIMESTAMP)

### messages
- id (SERIAL PK)
- conversation_id (FK ? conversations.id)
- sender_id (FK ? users.id)
- content (TEXT)
- message_type (ENUM)
- is_read (BOOLEAN)
- created_at (TIMESTAMP)

### reviews
- id (SERIAL PK)
- request_id (FK ? requests.id)
- customer_id (FK ? users.id)
- provider_id (FK ? providers.id)
- rating (INT)
- comment (TEXT)
- status (ENUM: pending, approved, rejected)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### payments
- id (SERIAL PK)
- request_id (FK ? requests.id)
- customer_id (FK ? users.id)
- provider_id (FK ? providers.id)
- amount (DECIMAL)
- currency (VARCHAR)
- status (ENUM)
- flutterwave_ref (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### notifications
- id (SERIAL PK)
- user_id (FK ? users.id)
- type (VARCHAR)
- title (VARCHAR)
- content (TEXT)
- is_read (BOOLEAN)
- metadata (JSONB)
- created_at (TIMESTAMP)

### admin_users
- id (SERIAL PK)
- user_id (FK ? users.id)
- permissions (ARRAY)
- created_at (TIMESTAMP)

### audit_logs
- id (SERIAL PK)
- user_id (FK ? users.id)
- action (VARCHAR)
- resource (VARCHAR)
- resource_id (INT)
- ip_address (VARCHAR)
- user_agent (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMP)

### provider_availability
- id (SERIAL PK)
- provider_id (FK ? providers.id)
- day_of_week (INT)
- start_time (TIME)
- end_time (TIME)
- is_available (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### password_resets
- id (SERIAL PK)
- user_id (FK ? users.id)
- token (VARCHAR)
- expires_at (TIMESTAMP)
- used (BOOLEAN)
- created_at (TIMESTAMP)

### refresh_tokens
- id (SERIAL PK)
- user_id (FK ? users.id)
- token (VARCHAR)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)
- revoked (BOOLEAN)

## Indexes
- users: email, phone, role
- providers: user_id, verification_status, rating
- service_categories: name, is_active
- services: provider_id, category_id, is_active
- requests: customer_id, provider_id, status, created_at
- conversations: request_id, customer_id, provider_id
- messages: conversation_id, sender_id, is_read
- reviews: request_id, customer_id, provider_id, status
- payments: request_id, customer_id, provider_id, status
- notifications: user_id, is_read, type
- audit_logs: user_id, action, resource, created_at

## Default Data
- 13 service categories (Electrical, Plumbing, Carpentry, etc.)
- Admin user account
- Default notification templates
