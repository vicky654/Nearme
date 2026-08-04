import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../src/middleware/validate';
import { AppError } from '../../src/utils/AppError';

function mockReqResNext(body: unknown) {
  const req = { body } as unknown as Request;
  const res = {} as unknown as Response;
  // See authenticate.test.ts for why `nextFn` (the real mock) is kept separate
  // from `next` (the `NextFunction`-typed value passed to the middleware).
  const nextFn = vi.fn();
  const next = nextFn as unknown as NextFunction;
  return { req, res, next, nextFn };
}

describe('validate middleware', () => {
  const schema = z.object({ email: z.string().email() });

  it('calls next() with no error and replaces req.body with the parsed value on success', () => {
    const { req, res, next, nextFn } = mockReqResNext({ email: 'a@b.com', extra: 'ignored' });
    validate(schema)(req, res, next);

    expect(nextFn).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@b.com' });
  });

  it('calls next() with an AppError(400) on validation failure', () => {
    const { req, res, next, nextFn } = mockReqResNext({ email: 'not-an-email' });
    validate(schema)(req, res, next);

    expect(nextFn).toHaveBeenCalledTimes(1);
    const err = nextFn.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });
});
