import { pool, query, getClient } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, ValidationError, AuthorizationError } from '../utils/AppError.js';

const VALID_STATUSES = ['pending', 'accepted', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const CUSTOMER_CANCEL_STATUSES = ['pending', 'accepted', 'scheduled'];
const PROVIDER_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['scheduled', 'rejected', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

const recordStatusChange = async (client, requestId, fromStatus, toStatus, changedBy, note = null) => {
  await client.query(
    `INSERT INTO request_status_history (request_id, from_status, to_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [requestId, fromStatus, toStatus, changedBy, note]
  );
};

export const createRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { providerId, categoryId, description, state, city, area, preferredDate, preferredTime } = req.body;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    throw new NotFoundError('Customer profile not found');
  }
  const customerId = customerResult.rows[0].id;

  const providerResult = await query(
    `SELECT pp.id, pp.is_available, u.status as user_status
     FROM provider_profiles pp
     JOIN users u ON pp.user_id = u.id
     WHERE pp.id = $1`,
    [providerId]
  );
  if (providerResult.rows.length === 0) {
    throw new NotFoundError('Provider not found');
  }
  const provider = providerResult.rows[0];
  if (!provider.is_available || provider.user_status !== 'active') {
    throw new AppError('Provider is not available', 400);
  }

  const categoryResult = await query('SELECT id FROM service_categories WHERE id = $1 AND is_active = true', [categoryId]);
  if (categoryResult.rows.length === 0) {
    throw new ValidationError([{ field: 'categoryId', message: 'Invalid or inactive category' }]);
  }

  const providerService = await query(
    'SELECT id FROM provider_services WHERE provider_id = $1 AND category_id = $2 AND is_active = true',
    [providerId, categoryId]
  );
  if (providerService.rows.length === 0) {
    throw new AppError('Provider does not offer this service', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `INSERT INTO service_requests (customer_id, provider_id, category_id, description, state, city, area, preferred_date, preferred_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [customerId, providerId, categoryId, description, state, city, area || null, preferredDate || null, preferredTime || null]
    );
    const request = requestResult.rows[0];

    await recordStatusChange(client, request.id, null, 'pending', userId, 'Request created');

    await client.query(
      `INSERT INTO conversations (request_id, customer_id, provider_id)
       VALUES ($1, $2, $3)`,
      [request.id, customerId, providerId]
    );

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'new_request', 'New Service Request', $2, 'request', $3)`,
      [provider.user_id, `You have a new service request: ${description.substring(0, 50)}...`, request.id]
    );

    await client.query('COMMIT');

    const response = ApiResponse.success(request, 'Service request created successfully', 201);
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const getMyRequests = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let customerId;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    if (customerResult.rows.length === 0) {
      throw new NotFoundError('Customer profile not found');
    }
    customerId = customerResult.rows[0].id;
  } else {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    if (providerResult.rows.length === 0) {
      throw new NotFoundError('Provider profile not found');
    }
    customerId = providerResult.rows[0].id;
  }

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (req.user.role === 'customer') {
    conditions.push(`sr.customer_id = $${paramIndex++}`);
    params.push(customerId);
  } else {
    conditions.push(`sr.provider_id = $${paramIndex++}`);
    params.push(customerId);
  }

  if (status) {
    conditions.push(`sr.status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM service_requests sr ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT sr.*, 
            cp.full_name as customer_name,
            pp.business_name as provider_name,
            sc.name as category_name
     FROM service_requests sr
     LEFT JOIN customer_profiles cp ON sr.customer_id = cp.id
     LEFT JOIN provider_profiles pp ON sr.provider_id = pp.id
     LEFT JOIN service_categories sc ON sr.category_id = sc.id
     ${whereClause}
     ORDER BY sr.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const response = ApiResponse.success({
    requests: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const getRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const requestResult = await query(
    `SELECT sr.*, 
            cp.full_name as customer_name, cp.phone as customer_phone, cp.address as customer_address,
            pp.business_name as provider_name, pp.phone as provider_phone,
            sc.name as category_name
     FROM service_requests sr
     LEFT JOIN customer_profiles cp ON sr.customer_id = cp.id
     LEFT JOIN provider_profiles pp ON sr.provider_id = pp.id
     LEFT JOIN service_categories sc ON sr.category_id = sc.id
     WHERE sr.id = $1`,
    [id]
  );

  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }

  const request = requestResult.rows[0];

  let hasAccess = false;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    hasAccess = customerResult.rows[0]?.id === request.customer_id;
  } else if (req.user.role === 'provider') {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    hasAccess = providerResult.rows[0]?.id === request.provider_id;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new AuthorizationError();
  }

  const response = ApiResponse.success(request);
  sendResponse(res, response);
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0 || customerResult.rows[0].id !== request.customer_id) {
    throw new AuthorizationError();
  }

  if (!CUSTOMER_CANCEL_STATUSES.includes(request.status)) {
    throw new AppError(`Cannot cancel request in ${request.status} status`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE service_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await recordStatusChange(client, id, request.status, 'cancelled', userId, 'Cancelled by customer');

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'request_cancelled', 'Request Cancelled', $2, 'request', $3)`,
      [request.provider_id, `Request #${id} was cancelled by the customer`, id]
    );

    await client.query('COMMIT');

    const response = ApiResponse.success(null, 'Request cancelled successfully');
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const acceptRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (providerResult.rows.length === 0 || providerResult.rows[0].id !== request.provider_id) {
    throw new AuthorizationError();
  }

  if (!PROVIDER_TRANSITIONS[request.status]?.includes('accepted')) {
    throw new AppError(`Cannot accept request in ${request.status} status`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE service_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await recordStatusChange(client, id, request.status, 'accepted', userId);

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'request_accepted', 'Request Accepted', $2, 'request', $3)`,
      [request.customer_id, `Your request #${id} has been accepted`, id]
    );

    await client.query('COMMIT');

    const response = ApiResponse.success(null, 'Request accepted successfully');
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { reason } = req.body;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (providerResult.rows.length === 0 || providerResult.rows[0].id !== request.provider_id) {
    throw new AuthorizationError();
  }

  if (!PROVIDER_TRANSITIONS[request.status]?.includes('rejected')) {
    throw new AppError(`Cannot reject request in ${request.status} status`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE service_requests SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2`,
      [reason || null, id]
    );

    await recordStatusChange(client, id, request.status, 'rejected', userId, reason);

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'request_rejected', 'Request Rejected', $2, 'request', $3)`,
      [request.customer_id, `Your request #${id} was rejected${reason ? ': ' + reason : ''}`, id]
    );

    await client.query('COMMIT');

    const response = ApiResponse.success(null, 'Request rejected successfully');
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const rescheduleRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { proposedDate, proposedTime } = req.body;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (providerResult.rows.length === 0 || providerResult.rows[0].id !== request.provider_id) {
    throw new AuthorizationError();
  }

  if (request.status !== 'pending' && request.status !== 'accepted') {
    throw new AppError(`Cannot reschedule request in ${request.status} status`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE service_requests SET proposed_date = $1, proposed_time = $2, updated_at = NOW() WHERE id = $3`,
      [proposedDate, proposedTime, id]
    );

    await recordStatusChange(client, id, request.status, request.status, userId, `Proposed new time: ${proposedDate} ${proposedTime}`);

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'request_rescheduled', 'Request Rescheduled', $2, 'request', $3)`,
      [request.customer_id, `Provider proposed new time for request #${id}: ${proposedDate} ${proposedTime}`, id]
    );

    await client.query('COMMIT');

    const response = ApiResponse.success(null, 'Reschedule proposed successfully');
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const updateRequestStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { status } = req.body;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (providerResult.rows.length === 0 || providerResult.rows[0].id !== request.provider_id) {
    throw new AuthorizationError();
  }

  const allowedTransitions = PROVIDER_TRANSITIONS[request.status] || [];
  if (!allowedTransitions.includes(status)) {
    throw new AppError(`Cannot transition from ${request.status} to ${status}`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const updates = ['status = $1', 'updated_at = NOW()'];
    const params = [status];
    let paramIndex = 2;

    if (status === 'completed') {
      updates.push('completed_at = NOW()');
    }

    await client.query(
      `UPDATE service_requests SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      [...params, id]
    );

    await recordStatusChange(client, id, request.status, status, userId);

    const notificationTitles = {
      scheduled: 'Service Scheduled',
      in_progress: 'Service Started',
      completed: 'Service Completed',
    };

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'status_update', $2, $3, 'request', $4)`,
      [request.customer_id, notificationTitles[status] || 'Status Update', `Your request #${id} is now ${status}`, id]
    );

    if (status === 'completed') {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
         VALUES ($1, 'review_reminder', 'Review Request', $2, 'request', $3)`,
        [request.customer_id, `Please review your experience with request #${id}`, id]
      );
    }

    await client.query('COMMIT');

    const response = ApiResponse.success(null, `Request status updated to ${status}`);
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const getProviderRequests = asyncHandler(async (req, res) => {
  return getMyRequests(req, res);
});

export const getRequestMessages = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  let hasAccess = false;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    hasAccess = customerResult.rows[0]?.id === request.customer_id;
  } else if (req.user.role === 'provider') {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    hasAccess = providerResult.rows[0]?.id === request.provider_id;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new AuthorizationError();
  }

  const conversationResult = await query('SELECT id FROM conversations WHERE request_id = $1', [id]);
  if (conversationResult.rows.length === 0) {
    const response = ApiResponse.success([]);
    return sendResponse(res, response);
  }

  const messagesResult = await query(
    `SELECT m.*, u.role as sender_role
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationResult.rows[0].id]
  );

  await query(
    `UPDATE messages SET read_at = NOW() 
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [conversationResult.rows[0].id, userId]
  );

  const response = ApiResponse.success(messagesResult.rows);
  sendResponse(res, response);
});

export const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { body } = req.body;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  let hasAccess = false;
  if (req.user.role === 'customer') {
    const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    hasAccess = customerResult.rows[0]?.id === request.customer_id;
  } else if (req.user.role === 'provider') {
    const providerResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    hasAccess = providerResult.rows[0]?.id === request.provider_id;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new AuthorizationError();
  }

  let conversationResult = await query('SELECT id FROM conversations WHERE request_id = $1', [id]);
  let conversationId;

  if (conversationResult.rows.length === 0) {
    const newConv = await query(
      `INSERT INTO conversations (request_id, customer_id, provider_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [id, request.customer_id, request.provider_id]
    );
    conversationId = newConv.rows[0].id;
  } else {
    conversationId = conversationResult.rows[0].id;
  }

  const messageResult = await query(
    `INSERT INTO messages (conversation_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [conversationId, userId, body]
  );

  const recipientId = req.user.role === 'customer' ? request.provider_id : request.customer_id;
  const recipientUserResult = await query('SELECT user_id FROM provider_profiles WHERE id = $1', [recipientId]);
  const recipientUserId = recipientUserResult.rows[0]?.user_id || 
    (await query('SELECT user_id FROM customer_profiles WHERE id = $1', [recipientId])).rows[0]?.user_id;

  if (recipientUserId) {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'new_message', 'New Message', $2, 'request', $3)`,
      [recipientUserId, `New message on request #${id}: ${body.substring(0, 50)}...`, id]
    );
  }

  await query(
    'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
    [conversationId]
  );

  const response = ApiResponse.success(messageResult.rows[0], 'Message sent successfully', 201);
  sendResponse(res, response);
});