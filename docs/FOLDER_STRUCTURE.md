# Project Folder Structure

## Root Directory
```
HANDYNAIJA/
+-- backend/
¦   +-- src/
¦   ¦   +-- routes/
¦   ¦   ¦   +-- auth.routes.js
¦   ¦   ¦   +-- user.routes.js
¦   ¦   ¦   +-- provider.routes.js
¦   ¦   ¦   +-- service.routes.js
¦   ¦   ¦   +-- request.routes.js
¦   ¦   ¦   +-- message.routes.js
¦   ¦   ¦   +-- review.routes.js
¦   ¦   ¦   +-- admin.routes.js
¦   ¦   +-- controllers/
¦   ¦   ¦   +-- auth.controller.js
¦   ¦   ¦   +-- user.controller.js
¦   ¦   ¦   +-- provider.controller.js
¦   ¦   ¦   +-- service.controller.js
¦   ¦   ¦   +-- request.controller.js
¦   ¦   ¦   +-- message.controller.js
¦   ¦   ¦   +-- review.controller.js
¦   ¦   ¦   +-- admin.controller.js
¦   ¦   +-- services/
¦   ¦   ¦   +-- auth.service.js
¦   ¦   ¦   +-- user.service.js
¦   ¦   ¦   +-- provider.service.js
¦   ¦   ¦   +-- service.service.js
¦   ¦   ¦   +-- request.service.js
¦   ¦   ¦   +-- message.service.js
¦   ¦   ¦   +-- review.service.js
¦   ¦   ¦   +-- notification.service.js
¦   ¦   ¦   +-- email.service.js
¦   ¦   +-- models/
¦   ¦   ¦   +-- User.js
¦   ¦   ¦   +-- Provider.js
¦   ¦   ¦   +-- Service.js
¦   ¦   ¦   +-- Request.js
¦   ¦   ¦   +-- Message.js
¦   ¦   ¦   +-- Review.js
¦   ¦   ¦   +-- Payment.js
¦   ¦   +-- middleware/
¦   ¦   ¦   +-- auth.middleware.js
¦   ¦   ¦   +-- validation.middleware.js
¦   ¦   ¦   +-- error.middleware.js
¦   ¦   ¦   +-- rateLimiter.middleware.js
¦   ¦   ¦   +-- role.middleware.js
¦   ¦   +-- utils/
¦   ¦   ¦   +-- apiResponse.js
¦   ¦   ¦   +-- asyncHandler.js
¦   ¦   ¦   +-- AppError.js
¦   ¦   ¦   +-- email.js
¦   ¦   ¦   +-- constants.js
¦   ¦   +-- config/
¦   ¦   ¦   +-- database.js
¦   ¦   ¦   +-- environment.js
¦   ¦   ¦   +-- app.js
¦   ¦   +-- scripts/
¦   ¦   ¦   +-- seed.js
¦   ¦   ¦   +-- migrate.js
¦   ¦   +-- app.js
¦   ¦   +-- server.js
¦   +-- migrations/
¦   ¦   +-- 001_initial_schema.sql
¦   ¦   +-- run.js
¦   +-- tests/
¦   ¦   +-- auth.test.js
¦   ¦   +-- user.test.js
¦   ¦   +-- provider.test.js
¦   ¦   +-- request.test.js
¦   ¦   +-- message.test.js
¦   +-- .env.example
¦   +-- .gitignore
¦   +-- package.json
¦   +-- README.md
+-- frontend/
¦   +-- public/
¦   ¦   +-- index.html
¦   ¦   +-- favicon.ico
¦   ¦   +-- manifest.json
¦   +-- src/
¦   ¦   +-- components/
¦   ¦   ¦   +-- Header.jsx
¦   ¦   ¦   +-- Footer.jsx
¦   ¦   ¦   +-- LoadingSpinner.jsx
¦   ¦   ¦   +-- Button.jsx
¦   ¦   ¦   +-- Input.jsx
¦   ¦   +-- pages/
¦   ¦   ¦   +-- Home.jsx
¦   ¦   ¦   +-- Login.jsx
¦   ¦   ¦   +-- Register.jsx
¦   ¦   ¦   +-- ProviderSearch.jsx
¦   ¦   ¦   +-- ProviderProfile.jsx
¦   ¦   ¦   +-- CreateRequest.jsx
¦   ¦   ¦   +-- RequestTracking.jsx
¦   ¦   ¦   +-- Chat.jsx
¦   ¦   ¦   +-- Dashboard.jsx
¦   ¦   ¦   +-- Admin.jsx
¦   ¦   +-- services/
¦   ¦   ¦   +-- api.js
¦   ¦   ¦   +-- auth.js
¦   ¦   ¦   +-- websocket.js
¦   ¦   +-- hooks/
¦   ¦   ¦   +-- useAuth.js
¦   ¦   ¦   +-- useApi.js
¦   ¦   +-- store/
¦   ¦   ¦   +-- store.js
¦   ¦   +-- utils/
¦   ¦   ¦   +-- constants.js
¦   ¦   ¦   +-- helpers.js
¦   ¦   +-- styles/
¦   ¦   ¦   +-- globals.css
¦   ¦   ¦   +-- variables.css
¦   ¦   +-- App.jsx
¦   ¦   +-- main.jsx
¦   +-- package.json
¦   +-- vite.config.js
¦   +-- tailwind.config.js
+-- docs/
¦   +-- PRODUCT_SPEC.md
¦   +-- PROBLEM_STATEMENT.md
¦   +-- USER_STORIES.md
¦   +-- MVP_SCOPE.md
¦   +-- ARCHITECTURE.md
¦   +-- DATABASE_SCHEMA.md
¦   +-- API_CONTRACT.md
¦   +-- FOLDER_STRUCTURE.md
¦   +-- ROADMAP.md
¦   +-- CONTRIBUTING.md
¦   +-- README.md
+-- .gitignore
+-- .env.example
+-- package.json
+-- README.md
+-- docker-compose.yml
```

## Naming Conventions
- **Files**: kebab-case (e.g., auth.routes.js)
- **Components**: PascalCase (e.g., Header.jsx)
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **URLs**: kebab-case (e.g., /api/v1/providers/search)

## Folder Purposes
- `backend/` - Node.js/Express API server
- `frontend/` - React web application
- `docs/` - Project documentation
- `migrations/` - Database schema migrations
- `tests/` - Automated test suites
