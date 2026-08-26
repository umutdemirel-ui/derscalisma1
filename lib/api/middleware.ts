import { NextRequest, NextResponse } from "next/server";
import { getSession, getCurrentUser } from "@/lib/auth/auth";

export async function requireAuth(request: NextRequest): Promise<{ user: Awaited<ReturnType<typeof getCurrentUser>>; response?: NextResponse }> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Giriş yapmalısınız" } },
        { status: 401 }
      ),
    };
  }

  return { user };
}

export async function optionalAuth(request: NextRequest): Promise<{ user: Awaited<ReturnType<typeof getCurrentUser>> }> {
  const user = await getCurrentUser();
  return { user };
}

export function createAuthError(code: string, message: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export function createSuccessResponse<T>(data: T) {
  return NextResponse.json({ success: true, ...data });
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         request.headers.get("x-real-ip") ||
         "unknown";
}