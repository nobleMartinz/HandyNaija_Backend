import { pool, query } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, ValidationError } from '../utils/AppError.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalCustomers,
    totalProviders,
    activeRequests,
    completedServices,
    pendingReports,
    recentActivity,
  ] = await Promise.all([
    query("SELECT COUNT(*) FROM users WHERE role = 'customer'"),
    query("SELECT COUNT(*) FROM users WHERE role = 'provider'"),
    query("SELECT COUNT(*) FROM service_requests WHERE status IN ('pending', 'accepted', 'scheduled', 'in_progress')"),
    query("SELECT COUNT(*) FROM service_requests WHERE status = 'completed'"),
    query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
    query(
      `SELECT 'new_provider' as type, u.created_at as time, u.email, pp.business_name as name
       FROM users u
       JOIN provider_profiles pp ON u.id = pp.user_id
       WHERE u.role = 'provider'
       ORDER BY u.created_at DESC LIMIT 5`
    ),
  ]);

  const response = ApiResponse.success({
    stats: {
      totalCustomers: parseInt(totalCustomers.rows[0].count),
      totalProviders: parseInt(totalProviders.rows[0].count),
      activeRequests: parseInt(activeRequests.rows[0].count),
      completedServices: parseInt(completedServices.rows[0].count),
      pendingReports: parseInt(pendingReports.rows[0].count),
    },
    recentActivity: recentActivity.rows,
  });

  sendResponse(res, response);
});

export const getUsers = asyncHandler(async (req, res) => {
  const { role, status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (role) {
    conditions.push(`u.role = $${paramIndex++}`);
    params.push(role);
  }
  if (status) {
    conditions.push(`u.status = $${paramIndex++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM users u ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT u.id, u.email, u.phone, u.role, u.status, u.email_verified, u.phone_verified, 
            u.last_login_at, u.created_at,
            cp.full_name, pp.business_name
     FROM users u
     LEFT JOIN customer_profiles cp ON u.id = cp.user_id AND u.role = 'customer'
     LEFT JOIN provider_profiles pp ON u.id = pp.user_id AND u.role = 'provider'
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const response = ApiResponse.success({
    users: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await query('SELECT id, role FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  if (result.rows[0].role === 'admin') {
    throw new AppError('Cannot modify admin user status', 400);
  }

  const updateResult = await query(
    'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );

  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, 'user_status_update', 'user', $2, $3)`,
    [req.user.id, id, { newStatus: status }]
  );

  const response = ApiResponse.success(updateResult.rows[0], `User status updated to ${status}`);
  sendResponse(res, response);
});

export const getProviders = asyncHandler(async (req, res) => {
  const { verificationStatus, status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (verificationStatus) {
    conditions.push(`pp.verification_status = $${paramIndex++}`);
    params.push(verificationStatus);
  }
  if (status) {
    conditions.push(`u.status = $${paramIndex++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(pp.business_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM provider_profiles pp JOIN users u ON pp.user_id = u.id ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT pp.*, u.email, u.phone, u.status, u.created_at,
            COUNT(ps.id) as service_count,
            COALESCE(AVG(r.rating), 0) as average_rating
     FROM provider_profiles pp
     JOIN users u ON pp.user_id = u.id
     LEFT JOIN provider_services ps ON pp.id = ps.provider_id AND ps.is_active = true
     LEFT JOIN reviews r ON pp.id = r.provider_id
     ${whereClause}
     GROUP BY pp.id, u.email, u.phone, u.status, u.created_at
     ORDER BY pp.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const response = ApiResponse.success({
    providers: result.rows.map(p => ({
      ...p,
      serviceCount: parseInt(p.service_count) || 0,
      averageRating: parseFloat(p.average_rating) || 0,
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const verifyProvider = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { verificationStatus } = req.body;

  const result = await query('SELECT id FROM provider_profiles WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Provider not found');
  }

  const updateResult = await query(
    'UPDATE provider_profiles SET verification_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [verificationStatus, id]
  );

  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, 'provider_verification', 'provider', $2, $3)`,
    [req.user.id, id, { verificationStatus }]
  );

  const userResult = await query('SELECT user_id FROM provider_profiles WHERE id = $1', [id]);
  if (userResult.rows.length > 0) {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, 'verification_update', 'Verification Status Updated', $2, 'provider', $3)`,
      [userResult.rows[0].user_id, `Your provider profile is now ${verificationStatus}`, id]
    );
  }

  const response = ApiResponse.success(updateResult.rows[0], `Provider verification updated to ${verificationStatus}`);
  sendResponse(res, response);
});

export const updateProviderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const providerResult = await query('SELECT user_id FROM provider_profiles WHERE id = $1', [id]);
  if (providerResult.rows.length === 0) {
    throw new NotFoundError('Provider not found');
  }

  await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, providerResult.rows[0].user_id]);

  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, 'provider_status_update', 'provider', $2, $3)`,
    [req.user.id, id, { newStatus: status }]
  );

  const response = ApiResponse.success(null, `Provider status updated to ${status}`);
  sendResponse(res, response);
});

export const getRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`sr.status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM service_requests sr ${whereClause}`, params);
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

export const getReviews = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status === 'pending') {
    conditions.push('r.is_moderated = false');
  } else if (status === 'moderated') {
    conditions.push('r.is_moderated = true');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM reviews r ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT r.*, cp.full_name as customer_name, pp.business_name as provider_name
     FROM reviews r
     JOIN customer_profiles cp ON r.customer_id = cp.id
     JOIN provider_profiles pp ON r.provider_id = pp.id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
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

export const getReports = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`r.status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM reports r ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT r.*, u.email as reporter_email
     FROM reports r
     JOIN users u ON r.reporter_id = u.id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const response = ApiResponse.success({
    reports: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const updateReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, action } = req.body;

  const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Report not found');
  }

  const updateResult = await query(
    `UPDATE reports SET status = $1, resolved_by = $2, resolved_at = NOW(), 
     metadata = jsonb_set(COALESCE(metadata, '{}'), '{adminAction}', $3)
     WHERE id = $4 RETURNING *`,
    [status, req.user.id, JSON.stringify(action || ''), id]
  );

  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, 'report_update', 'report', $2, $3)`,
    [req.user.id, id, { newStatus: status, action }]
  );

  const response = ApiResponse.success(updateResult.rows[0], `Report status updated to ${status}`);
  sendResponse(res, response);
});