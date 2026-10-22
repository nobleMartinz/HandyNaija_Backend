import { pool, query, getClient } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, ValidationError, AuthorizationError } from '../utils/AppError.js';

export const getProviderReviews = asyncHandler(async (req, res) => {
  const { providerId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const providerCheck = await query('SELECT id FROM provider_profiles WHERE id = $1', [providerId]);
  if (providerCheck.rows.length === 0) {
    throw new NotFoundError('Provider not found');
  }

  const countResult = await query('SELECT COUNT(*) FROM reviews WHERE provider_id = $1', [providerId]);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT r.*, cp.full_name as customer_name
     FROM reviews r
     JOIN customer_profiles cp ON r.customer_id = cp.id
     WHERE r.provider_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [providerId, limit, offset]
  );

  const statsResult = await query(
    `SELECT 
       COALESCE(AVG(rating), 0) as average_rating,
       COUNT(*) as total_reviews,
       COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
       COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
       COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
       COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
       COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
     FROM reviews WHERE provider_id = $1`,
    [providerId]
  );

  const response = ApiResponse.success({
    reviews: result.rows,
    stats: {
      averageRating: parseFloat(statsResult.rows[0].average_rating) || 0,
      totalReviews: parseInt(statsResult.rows[0].total_reviews) || 0,
      distribution: {
        5: parseInt(statsResult.rows[0].five_star) || 0,
        4: parseInt(statsResult.rows[0].four_star) || 0,
        3: parseInt(statsResult.rows[0].three_star) || 0,
        2: parseInt(statsResult.rows[0].two_star) || 0,
        1: parseInt(statsResult.rows[0].one_star) || 0,
      },
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const submitReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;
  const { rating, comment } = req.body;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    throw new NotFoundError('Customer profile not found');
  }
  const customerId = customerResult.rows[0].id;

  const requestResult = await query('SELECT * FROM service_requests WHERE id = $1', [requestId]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request not found');
  }
  const request = requestResult.rows[0];

  if (request.customer_id !== customerId) {
    throw new AuthorizationError('Not authorized to review this request');
  }

  if (request.status !== 'completed') {
    throw new AppError('Can only review completed services', 400);
  }

  const existingReview = await query('SELECT id FROM reviews WHERE request_id = $1', [requestId]);
  if (existingReview.rows.length > 0) {
    throw new AppError('Review already submitted for this request', 409);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const reviewResult = await client.query(
      `INSERT INTO reviews (request_id, customer_id, provider_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [requestId, customerId, request.provider_id, rating, comment || null]
    );

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'new_review', 'New Review', $2, 'review', $3)`,
      [
        (await query('SELECT user_id FROM provider_profiles WHERE id = $1', [request.provider_id])).rows[0].user_id,
        `You received a ${rating}-star review`,
        reviewResult.rows[0].id
      ]
    );

    await client.query('COMMIT');

    const response = ApiResponse.success(reviewResult.rows[0], 'Review submitted successfully', 201);
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let profileId;
  if (req.user.role === 'customer') {
    const result = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) throw new NotFoundError('Customer profile not found');
    profileId = result.rows[0].id;
  } else if (req.user.role === 'provider') {
    const result = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) throw new NotFoundError('Provider profile not found');
    profileId = result.rows[0].id;
  } else {
    throw new AuthorizationError();
  }

  const countResult = await query(
    'SELECT COUNT(*) FROM reviews WHERE customer_id = $1 OR provider_id = $1',
    [profileId]
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT r.*, 
            cp.full_name as customer_name,
            pp.business_name as provider_name,
            sr.description as request_description
     FROM reviews r
     LEFT JOIN customer_profiles cp ON r.customer_id = cp.id
     LEFT JOIN provider_profiles pp ON r.provider_id = pp.id
     LEFT JOIN service_requests sr ON r.request_id = sr.id
     WHERE r.customer_id = $1 OR r.provider_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [profileId, limit, offset]
  );

  const response = ApiResponse.success({
    reviews: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body;

  const reviewResult = await query('SELECT * FROM reviews WHERE id = $1', [id]);
  if (reviewResult.rows.length === 0) {
    throw new NotFoundError('Review not found');
  }
  const review = reviewResult.rows[0];

  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (action === 'approve') {
    updates.push('is_moderated = true');
    updates.push('moderation_note = $' + paramIndex++);
    params.push('Approved by admin');
  } else if (action === 'reject') {
    updates.push('is_moderated = true');
    updates.push('moderation_note = $' + paramIndex++);
    params.push(note || 'Rejected by admin');
  } else if (action === 'remove') {
    updates.push('is_moderated = true');
    updates.push('moderation_note = $' + paramIndex++);
    params.push(note || 'Removed by admin');
  }

  if (updates.length === 0) {
    throw new ValidationError([{ field: 'action', message: 'Invalid action' }]);
  }

  params.push(id);
  const result = await query(
    `UPDATE reviews SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  const response = ApiResponse.success(result.rows[0], `Review ${action}d successfully`);
  sendResponse(res, response);
});