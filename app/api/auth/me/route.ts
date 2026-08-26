export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/auth";
import { createSuccessResponse, withErrorHandling } from "@/lib/api/middleware";

async function GET_impl() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: true, authenticated: false, user: null });
  }

  return createSuccessResponse({
    authenticated: true,
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
}

export const GET = withErrorHandling(GET_impl);
