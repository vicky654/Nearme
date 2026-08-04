import { RequestHandler } from 'express';
import User from '../models/User';
import { AppError } from '../utils/AppError';

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new AppError(403, 'Forbidden: Admin access required');
    }

    next();
  } catch (err) {
    next(err);
  }
};
