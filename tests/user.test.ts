import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../lib/prisma';
import { registerTestUser } from './helpers';

describe('authenticated post API', () => {
    let email: string;
    let token: string;

    beforeAll(async () => {
        await prisma.$connect();
        ({ email, token } = await registerTestUser());
    });

    afterAll(async () => {
        if (email) {
            await prisma.user.deleteMany({ where: { email } });
        }
        await prisma.$disconnect();
    });

    it('requires authentication', async () => {
        const response = await request(app).get('/api/v1/posts/user');

        expect(response.status).toBe(401);
    });

    it('creates, lists, updates, and deletes the authenticated user post', async () => {
        const cookies = `token=${token}`;
        const createResponse = await request(app)
            .post('/api/v1/create')
            .set('Cookie', cookies)
            .set('Idempotency-Key', `create-${Date.now()}`)
            .send({ content: 'Integration test post content' });

        expect(createResponse.status).toBe(201);
        const postId = createResponse.body.post.id as string;
        expect(postId).toEqual(expect.any(String));

        const listResponse = await request(app)
            .get('/api/v1/posts/user')
            .set('Cookie', cookies);

        expect(listResponse.status).toBe(200);
        expect(listResponse.body).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: postId, author: { username: 'test-user' } })]),
        );

        const updateResponse = await request(app)
            .put(`/api/v1/${postId}`)
            .set('Cookie', cookies)
            .send({ content: 'Updated integration test post' });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.post.content).toBe('Updated integration test post');

        const deleteResponse = await request(app)
            .delete(`/api/v1/${postId}`)
            .set('Cookie', cookies)
            .set('Idempotency-Key', `delete-${Date.now()}`);

        expect(deleteResponse.status).toBe(200);
        expect(await prisma.post.findUnique({ where: { id: postId } })).toBeNull();
    });
});