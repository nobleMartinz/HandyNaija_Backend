import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireCustomer, requireAdmin } from '../middleware/role.middleware.js';
import * as reviewController from '../controllers/review.controller.js';

const router = Router();

router.get('/provider/:providerId', [
  param('providerId').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 20 }),
], validate, reviewController.getProviderReviews);

router.use(authenticate);

router.post('/request/:requestId', authorize('customer'), [
  param('requestId').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim(),
], validate, reviewController.submitReview);

router.get('/my-reviews', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 20 }),
], validate, reviewController.getMyReviews);

router.use(authorize('admin'));

router.patch('/:id/moderate', [
  param('id').isUUID(),
  body('action').isIn(['approve', 'reject', 'remove']),
  body('note').optional().trim(),
], validate, reviewController.moderateReview);

export default router;