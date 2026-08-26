import { NextRequest, NextResponse } from "next/server";
import { loginUser, validateEmail, setSessionCookie } from "@/lib/auth/auth";
import { rateLimit, getClientIp, createAuthError, createSuccessResponse } from "@/lib/api/middleware";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`login:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return createAuthError("RATE_LIMITED", "Çok fazla deneme, lütfen bekleyin", 429);
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return createAuthError("VALIDATION_ERROR", "E-posta ve şifre zorunludur");
    }

    if (!validateEmail(email)) {
      return createAuthError("VALIDATION_ERROR", "Geçersiz e-posta formatı");
    }

    const { user, token } = await loginUser(email.toLowerCase(), password, request);
    setSessionCookie(token);

    return createSuccessResponse({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        avatar: user.avatar,
        email_verified: user.email_verified,
        role: user.role,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return createAuthError("INVALID_CREDENTIALS", error.message);
    }
    console.error("Login error:", error);
    return createAuthError("SERVER_ERROR", "Giriş sırasında bir hata oluştu", 500);
  }
}