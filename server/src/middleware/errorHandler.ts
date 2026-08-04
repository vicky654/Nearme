import { ErrorRequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(env.NODE_ENV !== 'production' && !(err instanceof AppError) && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
};
