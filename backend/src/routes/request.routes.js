import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireCustomer, requireProvider } from '../middleware/role.middleware.js';
import * as requestController from '../controllers/request.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('customer'), [
  body('providerId').isUUID(),
  body('categoryId').isUUID(),
  body('description').trim().notEmpty(),
  body('state').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('area').optional().trim(),
  body('preferredDate').optional().isISO8601(),
  body('preferredTime').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
], validate, requestController.createRequest);

router.get('/', [
  query('status').optional().isIn(['pending', 'accepted', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, requestController.getMyRequests);

router.get('/:id', [
  param('id').isUUID(),
], validate, requestController.getRequest);

router.patch('/:id/cancel', authorize('customer'), [
  param('id').isUUID(),
], validate, requestController.cancelRequest);

router.get('/:id/messages', [
  param('id').isUUID(),
], validate, requestController.getRequestMessages);

router.post('/:id/messages', [
  param('id').isUUID(),
  body('body').trim().notEmpty(),
], validate, requestController.sendMessage);

router.use(authorize('provider'));

router.get('/provider/requests', [
  query('status').optional().isIn(['pending', 'accepted', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, requestController.getProviderRequests);

router.patch('/provider/requests/:id/accept', [
  param('id').isUUID(),
], validate, requestController.acceptRequest);

router.patch('/provider/requests/:id/reject', [
  param('id').isUUID(),
  body('reason').optional().trim(),
], validate, requestController.rejectRequest);

router.patch('/provider/requests/:id/reschedule', [
  param('id').isUUID(),
  body('proposedDate').isISO8601(),
  body('proposedTime').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
], validate, requestController.rescheduleRequest);

router.patch('/provider/requests/:id/status', [
  param('id').isUUID(),
  body('status').isIn(['scheduled', 'in_progress', 'completed']),
], validate, requestController.updateRequestStatus);

export default router;