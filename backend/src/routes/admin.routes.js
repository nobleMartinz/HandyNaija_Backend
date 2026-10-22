import { Router } from 'express';
import { param, query, body } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.getDashboard);

router.get('/users', [
  query('role').optional().isIn(['customer', 'provider']),
  query('status').optional().isIn(['active', 'suspended', 'pending_verification']),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, adminController.getUsers);

router.patch('/users/:id/status', [
  param('id').isUUID(),
  body('status').isIn(['active', 'suspended']),
], validate, adminController.updateUserStatus);

router.get('/providers', [
  query('verificationStatus').optional().isIn(['unverified', 'verified', 'trusted']),
  query('status').optional().isIn(['active', 'suspended']),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, adminController.getProviders);

router.patch('/providers/:id/verify', [
  param('id').isUUID(),
  body('verificationStatus').isIn(['verified', 'trusted']),
], validate, adminController.verifyProvider);

router.patch('/providers/:id/status', [
  param('id').isUUID(),
  body('status').isIn(['active', 'suspended']),
], validate, adminController.updateProviderStatus);

router.get('/requests', [
  query('status').optional().isIn(['pending', 'accepted', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, adminController.getRequests);

router.get('/reviews', [
  query('status').optional().isIn(['pending', 'moderated']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, adminController.getReviews);

router.get('/reports', [
  query('status').optional().isIn(['pending', 'under_review', 'resolved', 'dismissed']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, adminController.getReports);

router.patch('/reports/:id', [
  param('id').isUUID(),
  body('status').isIn(['under_review', 'resolved', 'dismissed']),
  body('action').optional().trim(),
], validate, adminController.updateReport);

export default router;