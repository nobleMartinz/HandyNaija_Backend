import { Router } from 'express';
import { query, body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import * as serviceController from '../controllers/service.controller.js';

const router = Router();

router.get('/', [
  query('active').optional().isBoolean(),
], validate, serviceController.getCategories);

router.get('/:id', serviceController.getCategory);

router.use(authenticate, authorize('admin'));

router.post('/', [
  body('name').trim().notEmpty(),
  body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }),
], validate, serviceController.createCategory);

router.patch('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
], validate, serviceController.updateCategory);

router.delete('/:id', [
  param('id').isUUID(),
], validate, serviceController.deleteCategory);

export default router;