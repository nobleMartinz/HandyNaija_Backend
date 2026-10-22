import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register/customer', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('area').trim().optional(),
], validate, authController.registerCustomer);

router.post('/register/provider', [
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('categoryId').isUUID().withMessage('Valid service category is required'),
  body('experienceYears').isInt({ min: 0 }).withMessage('Experience years must be a positive number'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('area').trim().optional(),
], validate, authController.registerProvider);

router.post('/login', [
  body('identifier').notEmpty().withMessage('Email or phone is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, authController.login);

router.post('/logout', authController.logout);

router.post('/refresh', authController.refreshToken);

router.post('/forgot-password', [
  body('identifier').notEmpty().withMessage('Email or phone is required'),
], validate, authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, authController.resetPassword);

router.get('/me', authController.getMe);

export default router;