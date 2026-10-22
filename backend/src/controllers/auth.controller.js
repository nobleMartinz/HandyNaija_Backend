import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, getClient } from '../config/database.js';
import { config } from '../config/environment.js';
import { generateTokens, verifyRefreshToken } from '../middleware/auth.middleware.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../utils/AppError.js';

const hashPassword = async (password) => {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const findUserByEmailOrPhone = async (identifier) => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1 OR phone = $1',
    [identifier]
  );
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await query(
    'SELECT id, email, phone, role, status FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

export const registerCustomer = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, state, city, area } = req.body;
  
  const existingUser = await findUserByEmailOrPhone(email);
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }
  
  const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existingPhone.rows.length > 0) {
    throw new ConflictError('Phone number already registered');
  }
  
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const passwordHash = await hashPassword(password);
    
    const userResult = await client.query(
      `INSERT INTO users (email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, 'customer', 'active')
       RETURNING id, email, phone, role, status, created_at`,
      [email, phone, passwordHash]
    );
    
    const user = userResult.rows[0];
    
    await client.query(
      `INSERT INTO customer_profiles (user_id, full_name, state, city, area)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, fullName, state, city, area || null]
    );
    
    await client.query('COMMIT');
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    
    const response = ApiResponse.success({
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role },
      accessToken,
      refreshToken,
    }, 'Customer registered successfully', 201);
    
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const registerProvider = asyncHandler(async (req, res) => {
  const { 
    businessName, email, phone, password, categoryId, 
    experienceYears, description, state, city, area 
  } = req.body;
  
  const existingUser = await findUserByEmailOrPhone(email);
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }
  
  const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existingPhone.rows.length > 0) {
    throw new ConflictError('Phone number already registered');
  }
  
  const categoryCheck = await query('SELECT id FROM service_categories WHERE id = $1 AND is_active = true', [categoryId]);
  if (categoryCheck.rows.length === 0) {
    throw new ValidationError([{ field: 'categoryId', message: 'Invalid or inactive service category' }]);
  }
  
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const passwordHash = await hashPassword(password);
    
    const userResult = await client.query(
      `INSERT INTO users (email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, 'provider', 'pending_verification')
       RETURNING id, email, phone, role, status, created_at`,
      [email, phone, passwordHash]
    );
    
    const user = userResult.rows[0];
    
    await client.query(
      `INSERT INTO provider_profiles (user_id, business_name, bio, experience_years, state, city, area, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'unverified')`,
      [user.id, businessName, description, experienceYears, state, city, area || null]
    );
    
    await client.query(
      `INSERT INTO provider_services (provider_id, category_id, is_active)
       VALUES ((SELECT id FROM provider_profiles WHERE user_id = $1), $2, true)`,
      [user.id, categoryId]
    );
    
    await client.query('COMMIT');
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    
    const response = ApiResponse.success({
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role },
      accessToken,
      refreshToken,
    }, 'Provider registered successfully. Profile pending verification.', 201);
    
    sendResponse(res, response);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  
  const user = await findUserByEmailOrPhone(identifier);
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }
  
  if (user.status === 'suspended') {
    throw new AppError('Account suspended', 403);
  }
  
  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401);
  }
  
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  
  const { accessToken, refreshToken } = generateTokens(user);
  
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  
  const response = ApiResponse.success({
    user: { id: user.id, email: user.email, phone: user.phone, role: user.role },
    accessToken,
    refreshToken,
  }, 'Login successful');
  
  sendResponse(res, response);
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
  
  const response = ApiResponse.success(null, 'Logged out successfully');
  sendResponse(res, response);
});

export const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  
  if (!refreshToken) {
    throw new AppError('Refresh token required', 401);
  }
  
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new AppError('Invalid refresh token', 401);
  }
  
  const user = await findUserById(decoded.id);
  if (!user || user.status === 'suspended') {
    throw new AppError('User not found or suspended', 401);
  }
  
  const tokens = generateTokens(user);
  
  res.cookie('token', tokens.accessToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  
  const response = ApiResponse.success({
    user: { id: user.id, email: user.email, phone: user.phone, role: user.role },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  }, 'Token refreshed');
  
  sendResponse(res, response);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  
  const user = await findUserByEmailOrPhone(identifier);
  if (!user) {
    const response = ApiResponse.success(null, 'If the account exists, a reset link has been sent');
    return sendResponse(res, response);
  }
  
  const resetToken = uuidv4();
  const resetExpires = new Date(Date.now() + 3600000);
  
  await query(
    'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
    [resetToken, resetExpires, user.id]
  );
  
  console.log(`Password reset token for ${user.email}: ${resetToken}`);
  
  const response = ApiResponse.success(null, 'If the account exists, a reset link has been sent');
  sendResponse(res, response);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  const result = await query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
    [token]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('Invalid or expired reset token', 400);
  }
  
  const user = result.rows[0];
  const passwordHash = await hashPassword(password);
  
  await query(
    'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
    [passwordHash, user.id]
  );
  
  const response = ApiResponse.success(null, 'Password reset successful');
  sendResponse(res, response);
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  let profile = null;
  
  if (user.role === 'customer') {
    const profileResult = await query(
      'SELECT * FROM customer_profiles WHERE user_id = $1',
      [user.id]
    );
    profile = profileResult.rows[0];
  } else if (user.role === 'provider') {
    const profileResult = await query(
      `SELECT pp.*, 
        json_agg(json_build_object('id', ps.id, 'categoryId', ps.category_id, 'categoryName', sc.name, 'description', ps.description)) as services
       FROM provider_profiles pp
       LEFT JOIN provider_services ps ON pp.id = ps.provider_id AND ps.is_active = true
       LEFT JOIN service_categories sc ON ps.category_id = sc.id
       WHERE pp.user_id = $1
       GROUP BY pp.id`,
      [user.id]
    );
    profile = profileResult.rows[0];
    if (profile) {
      profile.services = profile.services[0]?.id ? profile.services : [];
    }
  }
  
  const response = ApiResponse.success({
    user: { id: user.id, email: user.email, phone: user.phone, role: user.role },
    profile,
  });
  
  sendResponse(res, response);
});