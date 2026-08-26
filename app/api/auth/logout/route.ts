export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth/auth";
import { createSuccessResponse, withErrorHandling } from "@/lib/api/middleware";

async function POST_impl() {
  await logoutUser();
  return createSuccessResponse({ message: "Çıkış yapıldı" });
}

export const POST = withErrorHandling(POST_impl);
