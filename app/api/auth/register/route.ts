export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registerUser, loginUser, validateEmail, validatePassword, validateUsername, setSessionCookie } from "@/lib/auth/auth";
import { rateLimit, getClientIp, createAuthError, createSuccessResponse, withErrorHandling } from "@/lib/api/middleware";

async function POST_impl(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`register:${ip}`, 5, 60000);
  if (!rl.allowed) {
    return createAuthError("RATE_LIMITED", "Çok fazla deneme, lütfen bekleyin", 429);
  }

  try {
    const body = await request.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return createAuthError("VALIDATION_ERROR", "Tüm alanlar zorunludur");
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return createAuthError("VALIDATION_ERROR", usernameValidation.message!);
    }

    if (!validateEmail(email)) {
      return createAuthError("VALIDATION_ERROR", "Geçersiz e-posta formatı");
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return createAuthError("VALIDATION_ERROR", passwordValidation.message!);
    }

    const user = await registerUser(username, email.toLowerCase(), password);
    const { user: loggedInUser, token } = await loginUser(email.toLowerCase(), password, request);

    setSessionCookie(token);

    return createSuccessResponse({
      user: {
        id: loggedInUser.id,
        username: loggedInUser.username,
        email: loggedInUser.email,
        display_name: loggedInUser.display_name,
        avatar: loggedInUser.avatar,
        email_verified: loggedInUser.email_verified,
        role: loggedInUser.role,
        created_at: loggedInUser.created_at,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("zaten kayıtlı")) {
        return createAuthError("DUPLICATE", error.message);
      }
    }
    console.error("Register error:", error);
    return createAuthError("SERVER_ERROR", "Kayıt sırasında bir hata oluştu", 500);
  }
}

export const POST = withErrorHandling(POST_impl);
