export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
  
  bcrypt: {
    saltRounds: 12,
  },
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';