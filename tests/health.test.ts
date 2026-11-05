import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: { $queryRaw: queryRaw },
}));

import { app } from '../src/app';

describe('GET /health', () => {
  afterEach(() => {
    queryRaw.mockReset();
    vi.restoreAllMocks();
  });

  it('returns healthy when the database check succeeds', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns 503 and logs when the database check fails', async () => {
    queryRaw.mockRejectedValue(new Error('database unavailable'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'error' });
    expect(errorLog).toHaveBeenCalledWith(
      'Health check database query failed:',
      expect.any(Error),
    );
  });
});
