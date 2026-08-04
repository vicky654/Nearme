import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

export function validate(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, result.error.issues.map((i) => i.message).join(', ')));
      return;
    }
    req.body = result.data;
    next();
  };
}
