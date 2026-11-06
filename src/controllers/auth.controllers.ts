import { Request, Response, NextFunction } from 'express';
import { prisma } from "../lib/prisma";
import { loginSchema, signupSchema } from '../utils/auth.validation';
import {
    generateRefreshToken,
    generateToken,
    setAuthCookies,
} from '../middlewares/auth.middleware';
import { clearCookieOptions, clearRefreshCookieOptions } from '../utils/cookieOptions';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const clearRefreshCookie = (res: Response) => {
    res.clearCookie('refreshToken', clearRefreshCookieOptions);
};

export const signUp = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const result = signupSchema.safeParse(req.body)

    if (!result.success) {
        return res.status(400).json({
            errors: result.error.flatten().fieldErrors,
        });

    }
    try {
        const { username, email, password } = result.data;

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered!"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { username, email, password: hashedPassword },
            select: { id: true, username: true, email: true, profileImage: true },

        });
        const token = generateToken(String(user.id));
        const refreshToken = generateRefreshToken(String(user.id));
        setAuthCookies(res, token, refreshToken);
        return res.status(201).json({
            message: 'user created', user, token, refreshToken
        });
    } catch (error) {
        res.status(500).json({ message: 'something went wrong' })
    }

    next();
}


//Login Function
export const signIn = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const result = loginSchema.safeParse(req.body)

    if (!result.success) {
        return res.status(400).json({
            errors: result.error.flatten().fieldErrors,
        });
    }

    try {
        const { email, password } = result.data;

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, username: true, email: true, password: true, profileImage: true },
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }
        const token = generateToken(String(user.id));
        const refreshToken = generateRefreshToken(String(user.id));
        setAuthCookies(res, token, refreshToken);

        const { password: _password, ...safeUser } = user;
        return res.status(200).json({
            message: "Login successful",
            user: safeUser,
            token,
            refreshToken
        });
    } catch {
        res.status(500).json({
            message: "something went wrong"
        })
    }
    next();
}

export const refreshAccessToken = async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN!, {
            algorithms: ['HS256'],
        });

        if (typeof decoded === 'string' || typeof decoded.authorId !== 'string') {
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const authorId = Number(decoded.authorId);
        if (!Number.isSafeInteger(authorId) || authorId <= 0) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const user = await prisma.user.findUnique({
            where: { id: authorId },
            select: { id: true },
        });

        if (!user) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const token = generateToken(String(user.id));
        const rotatedRefreshToken = generateRefreshToken(String(user.id));
        setAuthCookies(res, token, rotatedRefreshToken);

        return res.status(200).json({
            message: 'Access token refreshed',
            token,
        });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        return res.status(500).json({ message: 'Failed to refresh access token' });
    }
};

export const logout = (_req: Request, res: Response) => {
    res.clearCookie('token', clearCookieOptions);
    res.clearCookie('refreshToken', clearRefreshCookieOptions);

    return res.status(200).json({ message: 'Logged out successfully' });
};