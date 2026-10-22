import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const swaggerSpec = require('../swagger.json');

import { config } from './config/environment.js';
import { pool, testConnection } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.middleware.js';
import { sanitizeInput } from './middleware/validation.middleware.js';

dotenv.config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is healthy', timestamp: new Date().toISOString() });
});

app.get('/api/v1', (req, res) => {
  res.json({ 
    success: true, 
    message: 'HandyNaija API v1.0', 
    documentation: '/api/v1/docs' 
  });
});

// Swagger documentation
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import providerRoutes from './routes/provider.routes.js';
import serviceRoutes from './routes/service.routes.js';
import requestRoutes from './routes/request.routes.js';
import messageRoutes from './routes/message.routes.js';
import reviewRoutes from './routes/review.routes.js';
import adminRoutes from './routes/admin.routes.js';

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  const connected = await testConnection();
  
  if (!connected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`API Base: http://localhost:${config.port}/api/v1`);
    console.log(`Swagger Docs: http://localhost:${config.port}/api/v1/docs`);
  });
};

startServer();

export default app;