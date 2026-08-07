import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

export const locationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  // Comfortably exceeds the client's movement-gate worst case (a 50m step at
  // highway speed can arrive every few seconds): ~1 send every 2.5s sustained.
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many location updates, please slow down.' },
  // This route sits behind `authenticate`, so key by the authenticated user
  // rather than IP — otherwise many users sharing one IP (e.g. mobile
  // carrier CGNAT) would collectively exhaust a single shared bucket.
  // NB: the installed express-rate-limit (7.5.1) predates the `ipKeyGenerator`
  // helper, so the IP fallback (for the rare case `req.userId` isn't set)
  // uses `req.ip` directly, matching this library's own default behavior.
  keyGenerator: (req) => req.userId ?? req.ip ?? 'unknown',
});
