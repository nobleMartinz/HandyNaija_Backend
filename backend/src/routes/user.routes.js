import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireCustomer, requireProvider, requireAdmin } from '../middleware/role.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.use(authenticate);

router.get('/profile', userController.getProfile);

router.patch('/profile', [
  body('fullName').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\+?[1-9]\d{1,14}$/),
  body('state').optional().trim(),
  body('city').optional().trim(),
  body('area').optional().trim(),
], validate, userController.updateProfile);

router.patch('/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], validate, userController.changePassword);

router.get('/notifications', userController.getNotifications);

router.patch('/notifications/:id/read', [
  param('id').isUUID(),
], validate, userController.markNotificationRead);

router.patch('/notifications/read-all', userController.markAllNotificationsRead);

export default router;