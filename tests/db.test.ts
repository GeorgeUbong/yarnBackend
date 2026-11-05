import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';

describe('database integration', () => {
    const email = `db-${randomUUID()}@example.com`;
    let userId: number | undefined;

    beforeAll(async () => {
        await prisma.$connect();
    });

    afterAll(async () => {
        if (userId !== undefined) {
            await prisma.user.deleteMany({ where: { id: userId } });
        }
        await prisma.$disconnect();
    });

    it('persists users and posts, loads their relation, and cascades user deletion', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'db-test-user',
                email,
                password: 'test-password-hash',
            },
        });
        userId = user.id;

        const post = await prisma.post.create({
            data: {
                authorId: user.id,
                content: 'Database integration test post',
            },
        });

        const loadedUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { posts: true },
        });

        expect(loadedUser?.posts).toEqual([expect.objectContaining({
            id: post.id,
            content: 'Database integration test post',
        })]);

        await prisma.user.delete({ where: { id: user.id } });
        userId = undefined;

        expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });
});
