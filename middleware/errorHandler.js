// ============================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// ============================================

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error to console for developers (in development mode)
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ ERROR DETAILS:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
  }

  // ============================================
  // MONGOOSE ERRORS
  // ============================================

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found`;
    error = {
      message,
      statusCode: 404,
    };
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `This ${field} '${value}' is already registered`;
    error = {
      message,
      statusCode: 400,
      field,
    };
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));

    error = {
      message: 'Validation failed',
      statusCode: 400,
      errors,
    };
  }

  // ============================================
  // JWT ERRORS
  // ============================================

  // JWT Malformed Error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please login again.';
    error = {
      message,
      statusCode: 401,
    };
  }

  // JWT Expired Error
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please login again.';
    error = {
      message,
      statusCode: 401,
    };
  }

  // ============================================
  // MULTER ERRORS (File Upload)
  // ============================================

  if (err.name === 'MulterError') {
    let message = 'File upload error';

    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large. Maximum size is 10MB.';
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum is 10 files.';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    }

    error = {
      message,
      statusCode: 400,
    };
  }

  // ============================================
  // CUSTOM APPLICATION ERRORS
  // ============================================

  // Not Found Error
  if (err.message.includes('not found')) {
    error.statusCode = 404;
  }

  // Unauthorized Error
  if (err.message.includes('not authorized') || err.message.includes('unauthorized')) {
    error.statusCode = 401;
  }

  // Forbidden Error
  if (err.message.includes('forbidden') || err.message.includes('access denied')) {
    error.statusCode = 403;
  }

  // Bad Request Error
  if (err.message.includes('invalid') || err.message.includes('required')) {
    error.statusCode = 400;
  }

  // ============================================
  // SEND ERROR RESPONSE
  // ============================================

  const response = {
    success: false,
    message: error.message || 'Server Error',
  };

  // Add errors array if validation errors exist
  if (error.errors) {
    response.errors = error.errors;
  }

  // Add field name if duplicate key error
  if (error.field) {
    response.field = error.field;
  }

  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.errorDetails = {
      name: err.name,
      code: err.code,
    };
  }

  res.status(error.statusCode || 500).json(response);
};

module.exports = errorHandler;