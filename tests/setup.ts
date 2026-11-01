import 'dotenv/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must point to a dedicated test database before running tests.');
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL === testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must be separate from DATABASE_URL to protect the application database.');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.ACCESS_TOKEN_SECRET ??= 'test-only-access-token-secret';
process.env.REFRESH_TOKEN ??= 'test-only-refresh-token-secret';
