import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const ACCESS_TOKEN_MAX_AGE = 4 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 10 * 24 * 60 * 60 * 1000;

export const generateToken = (authorId: string) => {
    return jwt.sign(
        { authorId },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: "4h", algorithm: "HS256" }
    )
}

export const generateRefreshToken = (authorId: string) => {
    return jwt.sign(
        { authorId },
        process.env.REFRESH_TOKEN!,
        { expiresIn: "10d", algorithm: "HS256" }
    );
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  const secure = process.env.NODE_ENV === 'production';

  res.cookie('token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/api/v1/refresh',
  });
};


//routes protection
export const routeGuard = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      message: "Not authorized, no token",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, {
      algorithms: ["HS256"],
    });

    if (typeof decoded === "string" || typeof decoded.authorId !== "string") {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.authorId = decoded.authorId;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};