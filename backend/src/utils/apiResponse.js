export class ApiResponse {
  static success(data = null, message = 'Success', statusCode = 200) {
    return {
      success: true,
      message,
      data,
      statusCode,
    };
  }

  static error(message = 'Error', statusCode = 500, errors = null) {
    return {
      success: false,
      message,
      errors,
      statusCode,
    };
  }

  static validationError(errors, message = 'Validation failed') {
    return {
      success: false,
      message,
      errors,
      statusCode: 400,
    };
  }

  static unauthorized(message = 'Unauthorized') {
    return {
      success: false,
      message,
      statusCode: 401,
    };
  }

  static forbidden(message = 'Forbidden') {
    return {
      success: false,
      message,
      statusCode: 403,
    };
  }

  static notFound(message = 'Resource not found') {
    return {
      success: false,
      message,
      statusCode: 404,
    };
  }

  static conflict(message = 'Resource already exists') {
    return {
      success: false,
      message,
      statusCode: 409,
    };
  }

  static tooManyRequests(message = 'Too many requests') {
    return {
      success: false,
      message,
      statusCode: 429,
    };
  }
}

export const sendResponse = (res, response) => {
  const { statusCode, ...body } = response;
  return res.status(statusCode).json(body);
};