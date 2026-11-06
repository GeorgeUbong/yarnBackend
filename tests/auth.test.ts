import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';
import { testPassword } from './helpers';

describe('authentication API', () => {
    const email = `auth-${randomUUID()}@example.com`;

    beforeAll(async () => {
        await prisma.$connect();
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email } });
        await prisma.$disconnect();
    });

    it('rejects invalid sign-up input', async () => {
        const response = await request(app)
            .post('/api/v1/signup')
            .send({ username: 'a', email: 'not-an-email', password: 'short' });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
    });

    it('registers a user and sets authentication cookies', async () => {
        const response = await request(app)
            .post('/api/v1/signup')
            .send({ username: 'auth-user', email, password: testPassword });

        expect(response.status).toBe(201);
        expect(response.body.user).toMatchObject({ username: 'auth-user', email });
        expect(response.body.token).toEqual(expect.any(String));
        const cookies = response.headers['set-cookie'];
        expect(cookies).toEqual(
            expect.arrayContaining([
                expect.stringContaining('token='),
                expect.stringContaining('refreshToken='),
                expect.stringContaining('SameSite=Lax'),
            ]),
        );
        expect(cookies.every((cookie) => cookie.includes('SameSite=Lax'))).toBe(true);
    });

    it('rejects duplicate email registration', async () => {
        const response = await request(app)
            .post('/api/v1/signup')
            .send({ username: 'auth-user', email, password: testPassword });

        expect(response.status).toBe(409);
    });

    it('allows a valid login and rejects an incorrect password', async () => {
        const login = await request(app)
            .post('/api/v1/login')
            .send({ email, password: testPassword });

        expect(login.status).toBe(200);
        expect(login.body.token).toEqual(expect.any(String));
        expect(login.body.user.profileImage).toBeNull();
        expect(login.body.user).not.toHaveProperty('password');

        const invalidLogin = await request(app)
            .post('/api/v1/login')
            .send({ email, password: 'WrongPassword123' });

        expect(invalidLogin.status).toBe(401);
    });
});