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

    it('updates the authenticated user name and validates the input', async () => {
        const cookies = `token=${token}`;
        const updateResponse = await request(app)
            .patch('/api/v1/users/me')
            .set('Cookie', cookies)
            .send({ username: 'updated-user' });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.user).toMatchObject({
            username: 'updated-user',
            profileImage: null,
        });

        const invalidResponse = await request(app)
            .patch('/api/v1/users/me')
            .set('Cookie', cookies)
            .send({ username: ' ' });

        expect(invalidResponse.status).toBe(400);
        expect(invalidResponse.body.errors.username).toBeDefined();

        await request(app)
            .patch('/api/v1/users/me')
            .set('Cookie', cookies)
            .send({ username: 'test-user' });
    });

    it('uploads and persists a supported profile image', async () => {
        const image = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZ8AAAAASUVORK5CYII=',
            'base64',
        );
        const response = await request(app)
            .post('/api/v1/users/me/profile-image')
            .set('Cookie', `token=${token}`)
            .attach('image', image, { filename: 'avatar.png', contentType: 'image/png' });

        expect(response.status).toBe(200);
        expect(response.body.user.profileImage).toBe(`data:image/png;base64,${image.toString('base64')}`);

        const savedUser = await prisma.user.findUnique({
            where: { email },
            select: { profileImage: true },
        });
        expect(savedUser?.profileImage).toBe(response.body.user.profileImage);
    });

    it('rejects profile images without supported image content', async () => {
        const response = await request(app)
            .post('/api/v1/users/me/profile-image')
            .set('Cookie', `token=${token}`)
            .attach('image', Buffer.from('not an image'), {
                filename: 'avatar.png',
                contentType: 'image/png',
            });

        expect(response.status).toBe(400);
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
            expect.arrayContaining([
                expect.objectContaining({
                    id: postId,
                    author: expect.objectContaining({ username: 'test-user' }),
                }),
            ]),
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