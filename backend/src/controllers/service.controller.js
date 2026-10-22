import { pool, query } from '../config/database.js';
import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError, ValidationError } from '../utils/AppError.js';

export const getCategories = asyncHandler(async (req, res) => {
  const { active = 'true' } = req.query;

  const result = await query(
    'SELECT * FROM service_categories WHERE is_active = $1 ORDER BY sort_order, name',
    [active === 'true']
  );

  const response = ApiResponse.success(result.rows);
  sendResponse(res, response);
});

export const getCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query('SELECT * FROM service_categories WHERE id = $1', [id]);
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Category not found');
  }

  const response = ApiResponse.success(result.rows[0]);
  sendResponse(res, response);
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, icon, sortOrder = 0 } = req.body;

  const existing = await query('SELECT id FROM service_categories WHERE slug = $1', [slug]);
  if (existing.rows.length > 0) {
    throw new AppError('Category slug already exists', 409);
  }

  const result = await query(
    `INSERT INTO service_categories (name, slug, description, icon, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, slug, description || null, icon || null, sortOrder]
  );

  const response = ApiResponse.success(result.rows[0], 'Category created successfully', 201);
  sendResponse(res, response);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, icon, isActive, sortOrder } = req.body;

  const existing = await query('SELECT id FROM service_categories WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Category not found');
  }

  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
  if (description !== undefined) { updates.push(`description = $${paramIndex++}`); params.push(description); }
  if (icon !== undefined) { updates.push(`icon = $${paramIndex++}`); params.push(icon); }
  if (isActive !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(isActive); }
  if (sortOrder !== undefined) { updates.push(`sort_order = $${paramIndex++}`); params.push(sortOrder); }

  if (updates.length === 0) {
    throw new ValidationError([{ field: 'body', message: 'No fields to update' }]);
  }

  params.push(id);
  const result = await query(
    `UPDATE service_categories SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  const response = ApiResponse.success(result.rows[0], 'Category updated successfully');
  sendResponse(res, response);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await query('SELECT id FROM service_categories WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Category not found');
  }

  const servicesUsing = await query('SELECT id FROM provider_services WHERE category_id = $1', [id]);
  if (servicesUsing.rows.length > 0) {
    throw new AppError('Cannot delete category with associated services', 400);
  }

  await query('DELETE FROM service_categories WHERE id = $1', [id]);

  const response = ApiResponse.success(null, 'Category deleted successfully');
  sendResponse(res, response);
});