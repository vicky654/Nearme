import { RequestHandler } from 'express';
import { verifyAccessToken } from '../services/tokenService';
import { AppError } from '../utils/AppError';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
};
