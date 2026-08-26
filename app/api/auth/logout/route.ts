import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth/auth";
import { createSuccessResponse } from "@/lib/api/middleware";

export async function POST() {
  await logoutUser();
  return createSuccessResponse({ message: "Çıkış yapıldı" });
}