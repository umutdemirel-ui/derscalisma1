import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { createSuccessResponse } from "@/lib/api/middleware";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT id, kazanim_kodu, ders_adi, sinif_seviyesi, aciklama
    FROM achievements
    ORDER BY ders_adi, sinif_seviyesi, kazanim_kodu
  `);
  const achievements = stmt.all() as any[];
  stmt.free();

  return createSuccessResponse({ achievements });
}