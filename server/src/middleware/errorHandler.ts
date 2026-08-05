import { ErrorRequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import multer from 'multer';

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const isUploadError = err instanceof multer.MulterError;
  const statusCode = err instanceof AppError ? err.statusCode : isUploadError ? 400 : 500;
  const message = err instanceof AppError
    ? err.message
    : isUploadError
      ? err.code === 'LIMIT_FILE_SIZE' ? 'Attachment must be 8 MB or smaller' : 'Unsupported attachment'
      : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(env.NODE_ENV !== 'production' && !(err instanceof AppError) && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
};
