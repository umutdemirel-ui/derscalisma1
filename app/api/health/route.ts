import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const result = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    return NextResponse.json({
      success: true,
      api: true,
      database: result?.ok === 1,
      platform: process.env.NETLIFY ? "netlify" : "local",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json({
      success: false,
      api: true,
      database: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
