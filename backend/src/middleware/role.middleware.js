import { AuthorizationError } from '../utils/AppError.js';

export const requireCustomer = (req, res, next) => {
  if (req.user?.role !== 'customer') {
    return next(new AuthorizationError('Customer access required'));
  }
  next();
};

export const requireProvider = (req, res, next) => {
  if (req.user?.role !== 'provider') {
    return next(new AuthorizationError('Provider access required'));
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new AuthorizationError('Admin access required'));
  }
  next();
};

export const requireOwnerOrAdmin = (resourceUserId) => {
  return (req, res, next) => {
    if (req.user?.role === 'admin') {
      return next();
    }
    
    if (req.user?.id !== resourceUserId) {
      return next(new AuthorizationError('Not authorized to access this resource'));
    }
    
    next();
  };
};

export const requireProviderOrAdmin = (req, res, next) => {
  if (!['provider', 'admin'].includes(req.user?.role)) {
    return next(new AuthorizationError('Provider or admin access required'));
  }
  next();
};