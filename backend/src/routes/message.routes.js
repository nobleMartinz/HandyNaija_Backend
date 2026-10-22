import { Router } from 'express';
import { param, query, body } from 'express-validator';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import * as messageController from '../controllers/message.controller.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', messageController.getConversations);

router.get('/conversations/:id', [
  param('id').isUUID(),
], validate, messageController.getConversation);

router.post('/conversations/:id/messages', [
  param('id').isUUID(),
  body('body').trim().notEmpty(),
], validate, messageController.sendMessage);

router.patch('/conversations/:id/read', [
  param('id').isUUID(),
], validate, messageController.markConversationRead);

export default router;