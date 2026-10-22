import rateLimit from 'express-rate-limit';
import { config } from '../config/environment.js';
import { RateLimitError } from '../utils/AppError.js';

export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new RateLimitError());
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new RateLimitError('Too many authentication attempts'));
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many API requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new RateLimitError());
  },
});

export const createLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message: message || 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new RateLimitError(message));
  },
});