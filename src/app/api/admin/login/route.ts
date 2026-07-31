import { NextResponse } from "next/server";
import {
  adminCookieOptions,
  createAdminSessionToken,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set in the environment." },
      { status: 503 },
    );
  }

  const body = await req.json();
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = createAdminSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieOptions(token));
  return response;
}
