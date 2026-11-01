import { Router } from 'express';
import {
  refreshAccessToken,
  signIn,
  signUp,
} from '../controllers/auth.controllers';
import { rateLimiter } from '../middlewares/rateLimiter';

const router = Router();

/**
 * @openapi
 * /api/v1/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create an account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain uppercase and lowercase letters and a number.
 *     responses:
 *       '201':
 *         description: Account created. Access and refresh cookies are set.
 *         headers:
 *           Set-Cookie:
 *             description: HttpOnly access-token and refresh-token cookies.
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: user created
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: Access token (expires in 4 hours).
 *                 refreshToken:
 *                   type: string
 *                   description: Refresh token (expires in 10 days).
 *       '400':
 *         description: Zod request-body validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '409':
 *         description: Email is already registered.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '429':
 *         description: More than 10 login or signup requests were made from this IP within 15 minutes.
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *             description: Seconds until requests are accepted again.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to create the account.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.post('/signup', rateLimiter, signUp);

/**
 * @openapi
 * /api/v1/login:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain uppercase and lowercase letters and a number.
 *     responses:
 *       '200':
 *         description: Signed in. Access and refresh cookies are set.
 *         headers:
 *           Set-Cookie:
 *             description: HttpOnly access-token and refresh-token cookies.
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: Access token (expires in 4 hours).
 *                 refreshToken:
 *                   type: string
 *                   description: Refresh token (expires in 10 days).
 *       '400':
 *         description: Zod request-body validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '401':
 *         description: Email or password is incorrect.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '429':
 *         description: More than 10 login or signup requests were made from this IP within 15 minutes.
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *             description: Seconds until requests are accepted again.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to sign in.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.post('/login', rateLimiter, signIn);

/**
 * @openapi
 * /api/v1/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh the access token
 *     description: Uses the refreshToken HttpOnly cookie and rotates both authentication cookies.
 *     security:
 *       - refreshCookieAuth: []
 *     responses:
 *       '200':
 *         description: Access token refreshed and authentication cookies updated.
 *         headers:
 *           Set-Cookie:
 *             description: Updated HttpOnly access-token and refresh-token cookies.
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Access token refreshed
 *                 token:
 *                   type: string
 *                   description: New access token (expires in 4 hours).
 *       '401':
 *         description: Refresh cookie is missing, invalid, expired, or belongs to a missing user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 *       '500':
 *         description: Server failed to refresh the access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageError'
 */
router.post('/refresh', refreshAccessToken);

export default router;
