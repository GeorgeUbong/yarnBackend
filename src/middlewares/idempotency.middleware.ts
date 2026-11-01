import { createHash } from 'node:crypto';
import { RequestHandler, Response } from 'express';

const RETENTION_MS = 24 * 60 * 60 * 1000;

interface CachedResponse {
  statusCode: number;
  body: string;
  contentType?: string;
}

interface IdempotencyRecord {
  expiresAt: number;
  fingerprint: string;
  response?: CachedResponse;
}

const records = new Map<string, IdempotencyRecord>();

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [key, record] of records) {
    if (record.expiresAt <= now) {
      records.delete(key);
    }
  }
}, 60 * 1000);
cleanupTimer.unref();

export const idempotencyKey: RequestHandler = (req, res, next) => {
  const key = req.get('Idempotency-Key');

  if (!key?.trim() || key.length > 255) {
    return res.status(400).json({
      message: 'A valid Idempotency-Key header is required.',
    });
  }

  if (!req.authorId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const cacheKey = JSON.stringify([req.authorId, req.method, req.originalUrl, key]);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ method: req.method, originalUrl: req.originalUrl, body: req.body ?? null }))
    .digest('hex');
  const now = Date.now();

  let existingRecord = records.get(cacheKey);
  if (existingRecord?.expiresAt !== undefined && existingRecord.expiresAt <= now) {
    records.delete(cacheKey);
    existingRecord = undefined;
  }

  if (existingRecord) {
    if (existingRecord.fingerprint !== fingerprint) {
      return res.status(409).json({
        message: 'This Idempotency-Key was already used for a different request.',
      });
    }

    if (!existingRecord.response) {
      return res.status(409).json({
        message: 'This request is already in progress.',
      });
    }

    if (existingRecord.response.contentType) {
      res.setHeader('Content-Type', existingRecord.response.contentType);
    }

    return res
      .status(existingRecord.response.statusCode)
      .send(existingRecord.response.body);
  }

  const record: IdempotencyRecord = {
    expiresAt: now + RETENTION_MS,
    fingerprint,
  };
  records.set(cacheKey, record);

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const serializedBody = JSON.stringify(body);
    const result = originalJson(body);

    if (serializedBody !== undefined) {
      const contentType = res.getHeader('Content-Type');
      record.response = {
        statusCode: res.statusCode,
        body: serializedBody,
        contentType: typeof contentType === 'string' ? contentType : undefined,
      };
    }

    return result;
  }) as Response['json'];

  next();
};
