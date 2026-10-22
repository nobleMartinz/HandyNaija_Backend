import { ApiResponse, sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  if (err instanceof AppError) {
    const response = ApiResponse.error(err.message, err.statusCode, err.errors);
    return sendResponse(res, response);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    const response = ApiResponse.validationError(errors);
    return sendResponse(res, response);
  }

  if (err.name === 'JsonWebTokenError') {
    const response = ApiResponse.unauthorized('Invalid token');
    return sendResponse(res, response);
  }

  if (err.name === 'TokenExpiredError') {
    const response = ApiResponse.unauthorized('Token expired');
    return sendResponse(res, response);
  }

  if (err.code === '23505') {
    const response = ApiResponse.conflict('Duplicate entry');
    return sendResponse(res, response);
  }

  if (err.code === '23503') {
    const response = ApiResponse.error('Referenced resource not found', 400);
    return sendResponse(res, response);
  }

  const response = ApiResponse.error('Internal server error', 500);
  return sendResponse(res, response);
};

export const notFoundHandler = (req, res) => {
  const response = ApiResponse.notFound(`Route ${req.method} ${req.path} not found`);
  return sendResponse(res, response);
};