import { RequestHandler } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

const requestsByClient = new Map<string, { count: number; resetAt: number }>();

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [clientId, entry] of requestsByClient) {
    if (entry.resetAt <= now) {
      requestsByClient.delete(clientId);
    }
  }
}, WINDOW_MS);
cleanupTimer.unref();

export const rateLimiter: RequestHandler = (req, res, next) => {
  const clientId = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  let entry = requestsByClient.get(clientId);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    requestsByClient.set(clientId, entry);
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      message: 'Too many  attempts. Please try again later.',
    });
  }

  entry.count += 1;
  res.setHeader('RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('RateLimit-Remaining', MAX_REQUESTS - entry.count);
  res.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
  next();
};
