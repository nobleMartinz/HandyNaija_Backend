import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireProvider, requireCustomer } from '../middleware/role.middleware.js';
import * as providerController from '../controllers/provider.controller.js';

const router = Router();

router.get('/', [
  query('category').optional().isUUID(),
  query('state').optional().trim(),
  query('city').optional().trim(),
  query('rating').optional().isFloat({ min: 1, max: 5 }),
  query('available').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, providerController.searchProviders);

router.get('/:id', [
  param('id').isUUID(),
], validate, providerController.getProviderProfile);

router.get('/:id/services', [
  param('id').isUUID(),
], validate, providerController.getProviderServices);

router.get('/:id/availability', [
  param('id').isUUID(),
], validate, providerController.getProviderAvailability);

router.get('/:id/reviews', [
  param('id').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 20 }),
], validate, providerController.getProviderReviews);

router.use(authenticate);

router.post('/profile', authorize('provider'), [
  body('businessName').trim().notEmpty(),
  body('description').trim().optional(),
  body('experienceYears').isInt({ min: 0 }),
  body('state').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('area').optional().trim(),
], validate, providerController.createProfile);

router.patch('/profile', authorize('provider'), [
  body('businessName').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('experienceYears').optional().isInt({ min: 0 }),
  body('state').optional().trim(),
  body('city').optional().trim(),
  body('area').optional().trim(),
  body('profileImageUrl').optional().isURL(),
], validate, providerController.updateProfile);

router.post('/services', authorize('provider'), [
  body('categoryId').isUUID(),
  body('description').optional().trim(),
  body('priceRange').optional().trim(),
], validate, providerController.addService);

router.patch('/services/:id', authorize('provider'), [
  param('id').isUUID(),
  body('description').optional().trim(),
  body('priceRange').optional().trim(),
  body('isActive').optional().isBoolean(),
], validate, providerController.updateService);

router.delete('/services/:id', authorize('provider'), [
  param('id').isUUID(),
], validate, providerController.deleteService);

router.put('/availability', authorize('provider'), [
  body('availability').isArray({ min: 1 }),
  body('availability.*.dayOfWeek').isInt({ min: 0, max: 6 }),
  body('availability.*.startTime').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('availability.*.endTime').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('availability.*.isAvailable').optional().isBoolean(),
], validate, providerController.updateAvailability);

router.get('/dashboard/stats', authorize('provider'), providerController.getDashboardStats);

export default router;