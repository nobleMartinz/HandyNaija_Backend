import { pool, query } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, ValidationError } from '../utils/AppError.js';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment.js';

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let profile = null;
  if (req.user.role === 'customer') {
    const result = await query('SELECT * FROM customer_profiles WHERE user_id = $1', [userId]);
    profile = result.rows[0];
  } else if (req.user.role === 'provider') {
    const result = await query(
      `SELECT pp.*, 
        json_agg(json_build_object('id', ps.id, 'categoryId', ps.category_id, 'categoryName', sc.name, 'description', ps.description, 'priceRange', ps.price_range)) FILTER (WHERE ps.id IS NOT NULL) as services
       FROM provider_profiles pp
       LEFT JOIN provider_services ps ON pp.id = ps.provider_id AND ps.is_active = true
       LEFT JOIN service_categories sc ON ps.category_id = sc.id
       WHERE pp.user_id = $1
       GROUP BY pp.id`,
      [userId]
    );
    profile = result.rows[0];
    if (profile) {
      profile.services = profile.services[0]?.id ? profile.services : [];
    }
  }

  const response = ApiResponse.success({
    user: { id: req.user.id, email: req.user.email, phone: req.user.phone, role: req.user.role },
    profile,
  });
  sendResponse(res, response);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { fullName, phone, state, city, area } = req.body;

  if (req.user.role === 'customer') {
    const profileResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
    if (profileResult.rows.length === 0) {
      throw new NotFoundError('Customer profile not found');
    }
    const profileId = profileResult.rows[0].id;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (fullName !== undefined) { updates.push(`full_name = $${paramIndex++}`); params.push(fullName); }
    if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); params.push(phone); }
    if (state !== undefined) { updates.push(`state = $${paramIndex++}`); params.push(state); }
    if (city !== undefined) { updates.push(`city = $${paramIndex++}`); params.push(city); }
    if (area !== undefined) { updates.push(`area = $${paramIndex++}`); params.push(area); }

    if (updates.length === 0) {
      throw new ValidationError([{ field: 'body', message: 'No fields to update' }]);
    }

    if (phone !== undefined) {
      const phoneCheck = await query('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, userId]);
      if (phoneCheck.rows.length > 0) {
        throw new AppError('Phone number already in use', 409);
      }
      await query('UPDATE users SET phone = $1 WHERE id = $2', [phone, userId]);
    }

    params.push(profileId);
    const result = await query(
      `UPDATE customer_profiles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const response = ApiResponse.success(result.rows[0], 'Profile updated successfully');
    sendResponse(res, response);
  } else if (req.user.role === 'provider') {
    const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
    if (profileResult.rows.length === 0) {
      throw new NotFoundError('Provider profile not found');
    }
    const profileId = profileResult.rows[0].id;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (fullName !== undefined) { updates.push(`business_name = $${paramIndex++}`); params.push(fullName); }
    if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); params.push(phone); }
    if (state !== undefined) { updates.push(`state = $${paramIndex++}`); params.push(state); }
    if (city !== undefined) { updates.push(`city = $${paramIndex++}`); params.push(city); }
    if (area !== undefined) { updates.push(`area = $${paramIndex++}`); params.push(area); }

    if (updates.length === 0) {
      throw new ValidationError([{ field: 'body', message: 'No fields to update' }]);
    }

    if (phone !== undefined) {
      const phoneCheck = await query('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, userId]);
      if (phoneCheck.rows.length > 0) {
        throw new AppError('Phone number already in use', 409);
      }
      await query('UPDATE users SET phone = $1 WHERE id = $2', [phone, userId]);
    }

    params.push(profileId);
    const result = await query(
      `UPDATE provider_profiles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const response = ApiResponse.success(result.rows[0], 'Profile updated successfully');
    sendResponse(res, response);
  } else {
    throw new AppError('Admin profile updates not supported', 400);
  }
});

export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);

  const response = ApiResponse.success(null, 'Password changed successfully');
  sendResponse(res, response);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const offset = (page - 1) * limit;

  const conditions = ['user_id = $1'];
  const params = [userId];
  let paramIndex = 2;

  if (unreadOnly === 'true') {
    conditions.push('read_at IS NULL');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(`SELECT COUNT(*) FROM notifications ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const response = ApiResponse.success({
    notifications: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
  sendResponse(res, response);
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await query(
    'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notification not found');
  }

  const response = ApiResponse.success(result.rows[0], 'Notification marked as read');
  sendResponse(res, response);
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );

  const response = ApiResponse.success(null, 'All notifications marked as read');
  sendResponse(res, response);
});