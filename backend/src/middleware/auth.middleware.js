import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { AuthenticationError, AuthorizationError } from '../utils/AppError.js';
import { pool } from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    const result = await pool.query(
      'SELECT id, email, phone, role, status FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('User no longer exists');
    }

    const user = result.rows[0];
    
    if (user.status === 'suspended') {
      throw new AuthenticationError('Account suspended');
    }

    req.user = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    next();
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return next(err);
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Invalid token'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    return next(new AuthenticationError('Authentication failed'));
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError());
    }
    
    next();
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    const result = await pool.query(
      'SELECT id, email, phone, role, status FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length > 0 && result.rows[0].status !== 'suspended') {
      req.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        role: result.rows[0].role,
      };
    }

    next();
  } catch (err) {
    next();
  }
};

export const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};