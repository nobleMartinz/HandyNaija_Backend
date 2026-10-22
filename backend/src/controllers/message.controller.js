import { pool, query } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, AuthorizationError } from '../utils/AppError.js';

export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let profileId;
  let profileTable;

  if (req.user.role === 'customer') {
    const result = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) throw new NotFoundError('Customer profile not found');
    profileId = result.rows[0].id;
    profileTable = 'customer_profiles';
  } else if (req.user.role === 'provider') {
    const result = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) throw new NotFoundError('Provider profile not found');
    profileId = result.rows[0].id;
    profileTable = 'provider_profiles';
  } else {
    throw new AuthorizationError();
  }

  const result = await query(
    `SELECT c.id, c.request_id, c.created_at, c.updated_at,
            sr.description, sr.status, sr.preferred_date, sr.preferred_time,
            cp.full_name as customer_name,
            pp.business_name as provider_name,
            (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND read_at IS NULL) as unread_count
     FROM conversations c
     JOIN service_requests sr ON c.request_id = sr.id
     JOIN customer_profiles cp ON sr.customer_id = cp.id
     JOIN provider_profiles pp ON sr.provider_id = pp.id
     WHERE c.customer_id = $2 OR c.provider_id = $2
     ORDER BY c.updated_at DESC`,
    [userId, profileId]
  );

  const response = ApiResponse.success(result.rows);
  sendResponse(res, response);
});

export const getConversation = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const convResult = await query(
    `SELECT c.*, sr.status, sr.description,
            cp.full_name as customer_name,
            pp.business_name as provider_name
     FROM conversations c
     JOIN service_requests sr ON c.request_id = sr.id
     JOIN customer_profiles cp ON sr.customer_id = cp.id
     JOIN provider_profiles pp ON sr.provider_id = pp.id
     WHERE c.id = $1`,
    [id]
  );

  if (convResult.rows.length === 0) {
    throw new NotFoundError('Conversation not found');
  }

  const conversation = convResult.rows[0];

  let hasAccess = false;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    hasAccess = customerResult.rows[0]?.id === conversation.customer_id;
  } else if (req.user.role === 'provider') {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    hasAccess = providerResult.rows[0]?.id === conversation.provider_id;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new AuthorizationError();
  }

  const messagesResult = await query(
    `SELECT m.*, u.role as sender_role
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [id]
  );

  await query(
    `UPDATE messages SET read_at = NOW() 
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [id, userId]
  );

  const response = ApiResponse.success({
    ...conversation,
    messages: messagesResult.rows,
  });

  sendResponse(res, response);
});

export const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { body } = req.body;

  const convResult = await query(
    `SELECT c.*, sr.customer_id, sr.provider_id
     FROM conversations c
     JOIN service_requests sr ON c.request_id = sr.id
     WHERE c.id = $1`,
    [id]
  );

  if (convResult.rows.length === 0) {
    throw new NotFoundError('Conversation not found');
  }

  const conversation = convResult.rows[0];

  let hasAccess = false;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    hasAccess = customerResult.rows[0]?.id === conversation.customer_id;
  } else if (req.user.role === 'provider') {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    hasAccess = providerResult.rows[0]?.id === conversation.provider_id;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new AuthorizationError();
  }

  const messageResult = await query(
    `INSERT INTO messages (conversation_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, userId, body]
  );

  const recipientId = req.user.role === 'customer' ? conversation.provider_id : conversation.customer_id;
  const recipientUserResult = req.user.role === 'customer' 
    ? await query('SELECT user_id FROM provider_profiles WHERE id = $1', [recipientId])
    : await query('SELECT user_id FROM customer_profiles WHERE id = $1', [recipientId]);
  
  const recipientUserId = recipientUserResult.rows[0]?.user_id;

  if (recipientUserId) {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'new_message', 'New Message', $2, 'conversation', $3)`,
      [recipientUserId, `New message: ${body.substring(0, 50)}...`, id]
    );
  }

  await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);

  const response = ApiResponse.success(messageResult.rows[0], 'Message sent successfully', 201);
  sendResponse(res, response);
});

export const markConversationRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const convResult = await query('SELECT * FROM conversations WHERE id = $1', [id]);
  if (convResult.rows.length === 0) {
    throw new NotFoundError('Conversation not found');
  }

  const conversation = convResult.rows[0];

  let hasAccess = false;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    hasAccess = customerResult.rows[0]?.id === conversation.customer_id;
  } else if (req.user.role === 'provider') {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    hasAccess = providerResult.rows[0]?.id === conversation.provider_id;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new AuthorizationError();
  }

  await query(
    `UPDATE messages SET read_at = NOW() 
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [id, userId]
  );

  const response = ApiResponse.success(null, 'Messages marked as read');
  sendResponse(res, response);
});