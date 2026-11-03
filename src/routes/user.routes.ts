import { Router } from 'express';
import { routeGuard } from '../middlewares/auth.middleware';
import { idempotencyKey } from '../middlewares/idempotency.middleware';
import { uploadProfileImage } from '../middlewares/profile-image.middleware';
import {
  getCurrentUser,
  updateProfileImage,
  updateUsername,
} from '../controllers/settings.controllers';
import {
  createPost,
  deletePost,
  getMyPosts,
  getPosts,
  searchPosts,
  updatePost,
} from '../controllers/app.controllers';

const router = Router();

/**
 * @openapi
 * /api/v1/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get the authenticated user's profile
 *     security:
 *       - accessCookieAuth: []
 *     responses:
 *       '200':
 *         description: Current user profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, user]
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       '401':
 *         description: Access cookie is missing or invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '404':
 *         description: Authenticated user no longer exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to retrieve current user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 * /api/v1/users/name:
 *   put:
 *     tags: [Users]
 *     summary: Update the authenticated user's name
 *     security:
 *       - accessCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 2
 *                 description: Leading and trailing whitespace is removed.
 *     responses:
 *       '200':
 *         description: Name updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, user]
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Name updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       '400':
 *         description: Username is missing or shorter than 2 characters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to update the name.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.get('/users/me', routeGuard, getCurrentUser);
router.put('/users/name', routeGuard, updateUsername);

/**
 * @openapi
 * /api/v1/users/me/profile-image:
 *   post:
 *     tags: [Users]
 *     summary: Upload or replace the authenticated user's profile image
 *     description: Stores a base64 data URI in the user's profileImage field. Files must be JPEG, PNG, GIF, or WebP and no larger than 5 MiB.
 *     security:
 *       - accessCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Profile image updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, user]
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile image updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       '400':
 *         description: Missing file, unsupported format, or uploaded file content does not match its declared image type.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '413':
 *         description: Uploaded image exceeds 5 MiB.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to update the profile image.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.post('/users/me/profile-image', routeGuard, uploadProfileImage, updateProfileImage);

/**
 * @openapi
 * /api/v1/posts/user:
 *   get:
 *     tags: [Posts]
 *     summary: Get the authenticated user's posts
 *     security:
 *       - accessCookieAuth: []
 *     responses:
 *       '200':
 *         description: Posts ordered by most recently posted. An empty array is returned when there are no posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PostWithAuthor'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to fetch posts.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.get('/posts/user', routeGuard, getMyPosts);

/**
 * @openapi
 * /api/v1/posts:
 *   get:
 *     tags: [Posts]
 *     summary: Get all posts
 *     security:
 *       - accessCookieAuth: []
 *     responses:
 *       '200':
 *         description: Posts with author details, or a message when there are no posts.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/PostWithAuthor'
 *                 - $ref: '#/components/schemas/Message'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to fetch posts.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.get('/posts', routeGuard, getPosts);

/**
 * @openapi
 * /api/v1/search:
 *   get:
 *     tags: [Posts]
 *     summary: Search all posts
 *     description: Searches post content across all users. Authentication is required.
 *     security:
 *       - accessCookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         description: Non-empty text to search for in post content across all users.
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Matching posts and count, or a message when there are no matches.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   required: [message, count, posts]
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Search results retrieved successfully
 *                     count:
 *                       type: integer
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PostWithAuthor'
 *                 - $ref: '#/components/schemas/Message'
 *       '400':
 *         description: Query parameter q is missing, empty, or not a string.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to search posts.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.get('/search', routeGuard, searchPosts);

/**
 * @openapi
 * /api/v1/create:
 *   post:
 *     tags: [Posts]
 *     summary: Create a post
 *     security:
 *       - accessCookieAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         description: Generate a unique key for each intentional create action and reuse it for retries. Duplicate requests replay the original response for 24 hours in this process; restarts clear the cache.
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Must not contain profane language. Leading/trailing whitespace is trimmed.
 *     responses:
 *       '201':
 *         description: Post created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post created successfully
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       '400':
 *         description: Idempotency-Key is missing or invalid, or Zod validation failed for content (missing, empty, over 1000 characters, or profane).
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationError'
 *                 - $ref: '#/components/schemas/MessageError'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '409':
 *         description: The key is already in use for a different request or the original request is still in progress.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to create the post.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.post('/create', routeGuard, idempotencyKey, createPost);

/**
 * @openapi
 * /api/v1/{id}:
 *   put:
 *     tags: [Posts]
 *     summary: Update one of the authenticated user's posts
 *     security:
 *       - accessCookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: CUID of the post.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       '200':
 *         description: Post updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post updated successfully
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       '400':
 *         description: Post ID is invalid or content is missing/empty.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '404':
 *         description: Post does not exist or is not owned by the authenticated user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to update the post.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.put('/:id', routeGuard, updatePost);

/**
 * @openapi
 * /api/v1/{id}:
 *   delete:
 *     tags: [Posts]
 *     summary: Delete one of the authenticated user's posts
 *     security:
 *       - accessCookieAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         description: Generate a unique key for each intentional delete action and reuse it for retries. Duplicate requests replay the original response for 24 hours in this process; restarts clear the cache.
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *       - in: path
 *         name: id
 *         required: true
 *         description: CUID of the post.
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Post deleted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       '400':
 *         description: Post ID is missing or invalid, or Idempotency-Key is missing or invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '401':
 *         description: Access cookie is missing, invalid, or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '404':
 *         description: Post does not exist or is not owned by the authenticated user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '409':
 *         description: The key is already in use for a different request or the original request is still in progress.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to delete the post.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.delete('/:id', routeGuard, idempotencyKey, deletePost);

export default router;
