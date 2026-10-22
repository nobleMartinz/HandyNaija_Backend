import { pool, query } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, ValidationError } from '../utils/AppError.js';

const buildProviderQuery = (filters) => {
  const conditions = ['pp.is_available = true', 'u.status = \'active\''];
  const params = [];
  let paramIndex = 1;

  if (filters.category) {
    conditions.push(`ps.category_id = $${paramIndex}`);
    params.push(filters.category);
    paramIndex++;
  }

  if (filters.state) {
    conditions.push(`pp.state ILIKE $${paramIndex}`);
    params.push(`%${filters.state}%`);
    paramIndex++;
  }

  if (filters.city) {
    conditions.push(`pp.city ILIKE $${paramIndex}`);
    params.push(`%${filters.city}%`);
    paramIndex++;
  }

  if (filters.rating) {
    conditions.push(`(
      SELECT COALESCE(AVG(r.rating), 0) 
      FROM reviews r 
      WHERE r.provider_id = pp.id
    ) >= $${paramIndex}`);
    params.push(filters.rating);
    paramIndex++;
  }

  return { conditions, params };
};

export const searchProviders = asyncHandler(async (req, res) => {
  const { category, state, city, rating, available, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const filters = { category, state, city, rating: rating ? parseFloat(rating) : null };
  const { conditions, params } = buildProviderQuery(filters);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(DISTINCT pp.id) 
     FROM provider_profiles pp
     JOIN users u ON pp.user_id = u.id
     LEFT JOIN provider_services ps ON pp.id = ps.provider_id AND ps.is_active = true
     ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT DISTINCT pp.id, pp.business_name, pp.bio, pp.experience_years, pp.city, pp.state, pp.area,
            pp.verification_status, pp.profile_image_url, pp.created_at,
            COALESCE(AVG(r.rating), 0) as average_rating,
            COUNT(r.id) as review_count,
            json_agg(DISTINCT jsonb_build_object(
              'id', ps.id, 'categoryId', ps.category_id, 'categoryName', sc.name, 'description', ps.description
            )) FILTER (WHERE ps.id IS NOT NULL) as services
     FROM provider_profiles pp
     JOIN users u ON pp.user_id = u.id
     LEFT JOIN provider_services ps ON pp.id = ps.provider_id AND ps.is_active = true
     LEFT JOIN service_categories sc ON ps.category_id = sc.id
     LEFT JOIN reviews r ON pp.id = r.provider_id
     ${whereClause}
     GROUP BY pp.id
     ORDER BY average_rating DESC NULLS LAST, pp.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const providers = result.rows.map(p => ({
    ...p,
    services: p.services[0]?.id ? p.services : [],
    averageRating: parseFloat(p.average_rating) || 0,
    reviewCount: parseInt(p.review_count) || 0,
  }));

  const response = ApiResponse.success({
    providers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

  sendResponse(res, response);
});

export const getProviderProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT pp.*, u.email, u.phone,
            COALESCE(AVG(r.rating), 0) as average_rating,
            COUNT(r.id) as review_count
     FROM provider_profiles pp
     JOIN users u ON pp.user_id = u.id
     LEFT JOIN reviews r ON pp.id = r.provider_id
     WHERE pp.id = $1
     GROUP BY pp.id, u.email, u.phone`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Provider not found');
  }

  const provider = result.rows[0];

  const servicesResult = await query(
    `SELECT ps.id, ps.category_id, sc.name as category_name, ps.description, ps.price_range
     FROM provider_services ps
     JOIN service_categories sc ON ps.category_id = sc.id
     WHERE ps.provider_id = $1 AND ps.is_active = true
     ORDER BY sc.name`,
    [id]
  );

  const availabilityResult = await query(
    `SELECT day_of_week, start_time, end_time, is_available
     FROM provider_availability
     WHERE provider_id = $1
     ORDER BY day_of_week`,
    [id]
  );

  const response = ApiResponse.success({
    ...provider,
    services: servicesResult.rows,
    availability: availabilityResult.rows,
    averageRating: parseFloat(provider.average_rating) || 0,
    reviewCount: parseInt(provider.review_count) || 0,
  });

  sendResponse(res, response);
});

export const getProviderServices = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT ps.id, ps.category_id, sc.name as category_name, ps.description, ps.price_range, ps.is_active
     FROM provider_services ps
     JOIN service_categories sc ON ps.category_id = sc.id
     WHERE ps.provider_id = $1
     ORDER BY sc.name`,
    [id]
  );

  const response = ApiResponse.success(result.rows);
  sendResponse(res, response);
});

export const getProviderAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT day_of_week, start_time, end_time, is_available
     FROM provider_availability
     WHERE provider_id = $1
     ORDER BY day_of_week`,
    [id]
  );

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const availability = result.rows.map(r => ({
    ...r,
    dayName: days[r.day_of_week],
  }));

  const response = ApiResponse.success(availability);
  sendResponse(res, response);
});

export const getProviderReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const countResult = await query(
    'SELECT COUNT(*) FROM reviews WHERE provider_id = $1',
    [id]
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT r.*, cp.full_name as customer_name
     FROM reviews r
     JOIN customer_profiles cp ON r.customer_id = cp.id
     WHERE r.provider_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset]
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

export const createProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { businessName, description, experienceYears, state, city, area, profileImageUrl } = req.body;

  const existing = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) {
    throw new AppError('Provider profile already exists', 409);
  }

  const result = await query(
    `INSERT INTO provider_profiles (user_id, business_name, bio, experience_years, state, city, area, profile_image_url, verification_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unverified')
     RETURNING *`,
    [userId, businessName, description, experienceYears, state, city, area || null, profileImageUrl || null]
  );

  await query(
    'UPDATE users SET role = \'provider\' WHERE id = $1',
    [userId]
  );

  const response = ApiResponse.success(result.rows[0], 'Provider profile created successfully', 201);
  sendResponse(res, response);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { businessName, description, experienceYears, state, city, area, profileImageUrl } = req.body;

  const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (profileResult.rows.length === 0) {
    throw new NotFoundError('Provider profile not found');
  }

  const profileId = profileResult.rows[0].id;

  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (businessName !== undefined) { updates.push(`business_name = $${paramIndex++}`); params.push(businessName); }
  if (description !== undefined) { updates.push(`bio = $${paramIndex++}`); params.push(description); }
  if (experienceYears !== undefined) { updates.push(`experience_years = $${paramIndex++}`); params.push(experienceYears); }
  if (state !== undefined) { updates.push(`state = $${paramIndex++}`); params.push(state); }
  if (city !== undefined) { updates.push(`city = $${paramIndex++}`); params.push(city); }
  if (area !== undefined) { updates.push(`area = $${paramIndex++}`); params.push(area); }
  if (profileImageUrl !== undefined) { updates.push(`profile_image_url = $${paramIndex++}`); params.push(profileImageUrl); }

  if (updates.length === 0) {
    throw new ValidationError([{ field: 'body', message: 'No fields to update' }]);
  }

  params.push(profileId);
  const result = await query(
    `UPDATE provider_profiles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  const response = ApiResponse.success(result.rows[0], 'Profile updated successfully');
  sendResponse(res, response);
});

export const addService = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { categoryId, description, priceRange } = req.body;

  const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (profileResult.rows.length === 0) {
    throw new NotFoundError('Provider profile not found');
  }
  const providerId = profileResult.rows[0].id;

  const categoryCheck = await query('SELECT id FROM service_categories WHERE id = $1 AND is_active = true', [categoryId]);
  if (categoryCheck.rows.length === 0) {
    throw new ValidationError([{ field: 'categoryId', message: 'Invalid or inactive service category' }]);
  }

  const existing = await query(
    'SELECT id FROM provider_services WHERE provider_id = $1 AND category_id = $2',
    [providerId, categoryId]
  );
  if (existing.rows.length > 0) {
    throw new AppError('Service already exists for this provider', 409);
  }

  const result = await query(
    `INSERT INTO provider_services (provider_id, category_id, description, price_range, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [providerId, categoryId, description || null, priceRange || null]
  );

  const response = ApiResponse.success(result.rows[0], 'Service added successfully', 201);
  sendResponse(res, response);
});

export const updateService = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { description, priceRange, isActive } = req.body;

  const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (profileResult.rows.length === 0) {
    throw new NotFoundError('Provider profile not found');
  }
  const providerId = profileResult.rows[0].id;

  const serviceCheck = await query('SELECT id FROM provider_services WHERE id = $1 AND provider_id = $2', [id, providerId]);
  if (serviceCheck.rows.length === 0) {
    throw new NotFoundError('Service not found');
  }

  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (description !== undefined) { updates.push(`description = $${paramIndex++}`); params.push(description); }
  if (priceRange !== undefined) { updates.push(`price_range = $${paramIndex++}`); params.push(priceRange); }
  if (isActive !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(isActive); }

  if (updates.length === 0) {
    throw new ValidationError([{ field: 'body', message: 'No fields to update' }]);
  }

  params.push(id);
  const result = await query(
    `UPDATE provider_services SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  const response = ApiResponse.success(result.rows[0], 'Service updated successfully');
  sendResponse(res, response);
});

export const deleteService = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (profileResult.rows.length === 0) {
    throw new NotFoundError('Provider profile not found');
  }
  const providerId = profileResult.rows[0].id;

  const result = await query(
    'DELETE FROM provider_services WHERE id = $1 AND provider_id = $2 RETURNING id',
    [id, providerId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Service not found');
  }

  const response = ApiResponse.success(null, 'Service deleted successfully');
  sendResponse(res, response);
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { availability } = req.body;

  const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (profileResult.rows.length === 0) {
    throw new NotFoundError('Provider profile not found');
  }
  const providerId = profileResult.rows[0].id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM provider_availability WHERE provider_id = $1', [providerId]);
    
    for (const slot of availability) {
      await client.query(
        `INSERT INTO provider_availability (provider_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1, $2, $3, $4, $5)`,
        [providerId, slot.dayOfWeek, slot.startTime, slot.endTime, slot.isAvailable !== false]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const result = await query(
    'SELECT day_of_week, start_time, end_time, is_available FROM provider_availability WHERE provider_id = $1 ORDER BY day_of_week',
    [providerId]
  );

  const response = ApiResponse.success(result.rows, 'Availability updated successfully');
  sendResponse(res, response);
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const profileResult = await query('SELECT id FROM provider_profiles WHERE user_id = $1', [userId]);
  if (profileResult.rows.length === 0) {
    throw new NotFoundError('Provider profile not found');
  }
  const providerId = profileResult.rows[0].id;

  const [newRequests, upcoming, completed, rating] = await Promise.all([
    query('SELECT COUNT(*) FROM service_requests WHERE provider_id = $1 AND status = \'pending\'', [providerId]),
    query('SELECT COUNT(*) FROM service_requests WHERE provider_id = $1 AND status IN (\'accepted\', \'scheduled\')', [providerId]),
    query('SELECT COUNT(*) FROM service_requests WHERE provider_id = $1 AND status = \'completed\'', [providerId]),
    query('SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count FROM reviews WHERE provider_id = $1', [providerId]),
  ]);

  const response = ApiResponse.success({
    newRequests: parseInt(newRequests.rows[0].count),
    upcoming: parseInt(upcoming.rows[0].count),
    completed: parseInt(completed.rows[0].count),
    averageRating: parseFloat(rating.rows[0].avg_rating) || 0,
    reviewCount: parseInt(rating.rows[0].review_count) || 0,
  });

  sendResponse(res, response);
});