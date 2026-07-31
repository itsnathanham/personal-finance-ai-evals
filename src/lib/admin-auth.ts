import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "hfc_admin_session";

function expectedToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const secret = process.env.ADMIN_SESSION_SECRET ?? password;
  return createHmac("sha256", secret).update(`admin:${password}`).digest("hex");
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createAdminSessionToken(): string {
  const token = expectedToken();
  if (!token) throw new Error("ADMIN_PASSWORD is not configured");
  return token;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function adminCookieOptions(token: string) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}
