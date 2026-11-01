import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../src/index';

export const testPassword = 'TestPassword123';

export const registerTestUser = async () => {
    const email = `test-${randomUUID()}@example.com`;
    const response = await request(app)
        .post('/api/v1/signup')
        .send({ username: 'test-user', email, password: testPassword });

    if (response.status !== 201) {
        throw new Error(`Could not create test user: ${response.status} ${JSON.stringify(response.body)}`);
    }

    return { email, token: response.body.token as string, user: response.body.user };
};
