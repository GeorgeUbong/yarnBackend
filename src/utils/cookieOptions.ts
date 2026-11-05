import type { CookieOptions } from "express";

const isProd = process.env.NODE_ENV === "production";

type SameSite = "lax" | "strict" | "none";

function resolveSameSite(): SameSite {
  const value = process.env.COOKIE_SAMESITE?.toLowerCase();
  if (value === "lax" || value === "strict" || value === "none") return value;
  return isProd ? "none" : "lax";
}

const baseAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: resolveSameSite(),
};

export const authCookieOptions: CookieOptions = {
  ...baseAuthCookieOptions,
  maxAge: 4 * 60 * 60 * 1000,
  path: "/",
};

export const refreshCookieOptions: CookieOptions = {
  ...baseAuthCookieOptions,
  maxAge: 10 * 24 * 60 * 60 * 1000,
  path: "/api/v1/refresh",
};

export const clearCookieOptions: CookieOptions = {
  ...baseAuthCookieOptions,
  path: "/",
};

export const clearRefreshCookieOptions: CookieOptions = {
  ...baseAuthCookieOptions,
  path: "/api/v1/refresh",
};
