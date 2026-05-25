import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pawchart-secret-key';

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is blocked or inactive.' });
    }

    // Attach user info to request
    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      clinicId: user.clinic_id
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    res.status(500).json({ message: 'Server error during authentication.' });
  }
};

export const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const hasRole = roles.includes(req.user.role);

    if (!hasRole) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        requiredRole: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

export const checkClinicAccess = (req, res, next) => {
  // Prep structure for Phase 3 clinic scoping
  const clinicIdFromParams = req.params.clinicId || req.body.clinic_id || req.query.clinic_id;

  // super_admin can access all clinics
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Check if user's clinic matches
  if (req.user.clinicId && clinicIdFromParams && req.user.clinicId.toString() !== clinicIdFromParams.toString()) {
    return res.status(403).json({ 
      message: 'Access denied. You can only access data from your clinic.' 
    });
  }

  next();
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.status === 'active') {
        req.user = {
          userId: user._id,
          email: user.email,
          role: user.role,
          clinicId: user.clinic_id
        };
      }
    }

    next();
  } catch (error) {
    next();
  }
};

export const checkSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      message: 'Access denied. Super Admin privileges required.',
      userRole: req.user.role
    });
  }

  next();
};

export const checkClinicAdminOrSuper = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (!['super_admin', 'clinic_admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.',
      userRole: req.user.role
    });
  }

  next();
};

export const getQueryFilter = (req) => {
  const clinicId = req.header('x-clinic-id') || req.query.clinic_id || (req.user && req.user.clinicId);
  if (clinicId) {
    let clinicObjId = clinicId;
    if (mongoose.Types.ObjectId.isValid(clinicId)) {
      clinicObjId = new mongoose.Types.ObjectId(clinicId);
    }
    return { clinic_id: clinicObjId };
  }
  return {};
};

