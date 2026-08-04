import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../src/middleware/authenticate';
import { signAccessToken } from '../../src/services/tokenService';
import { AppError } from '../../src/utils/AppError';

function mockReqResNext(authHeader: string | undefined) {
  const req = { headers: { authorization: authHeader } } as unknown as Request;
  const res = {} as unknown as Response;
  // Keep a separately-typed reference to the mock for assertions (`.mock.calls`
  // etc.) — the `as unknown as NextFunction` cast passed to the middleware loses
  // the `.mock` property since `NextFunction` doesn't declare it.
  const nextFn = vi.fn();
  const next = nextFn as unknown as NextFunction;
  return { req, res, next, nextFn };
}

describe('authenticate middleware', () => {
  it('sets req.userId and calls next() with a valid bearer token', () => {
    const token = signAccessToken('user-abc');
    const { req, res, next, nextFn } = mockReqResNext(`Bearer ${token}`);

    authenticate(req, res, next);

    expect(req.userId).toBe('user-abc');
    expect(nextFn).toHaveBeenCalledWith();
  });

  it('calls next() with AppError(401) when the header is missing', () => {
    const { req, res, next, nextFn } = mockReqResNext(undefined);

    authenticate(req, res, next);

    expect(nextFn).toHaveBeenCalledTimes(1);
    const err = nextFn.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('calls next() with AppError(401) for an invalid token', () => {
    const { req, res, next, nextFn } = mockReqResNext('Bearer garbage');

    authenticate(req, res, next);

    expect(nextFn).toHaveBeenCalledTimes(1);
    const err = nextFn.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});
