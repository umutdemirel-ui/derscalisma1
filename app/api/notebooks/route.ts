import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";
import { randomUUID } from "crypto";

const MOCK_USER_ID = "anonymous-user";

export async function GET(request: NextRequest) {
  const { user } = await requireAuth(request);

  const db = await getDb();
  const stmt = db.prepare(`
    SELECT id, title, achievement_id, created_at, updated_at
    FROM notebooks
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `);
  const notebooks = stmt.all(user.id) as any[];
  stmt.free();

  return createSuccessResponse({ notebooks });
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth(request);

  try {
    const { title, achievement_id } = await request.json();

    const notebookId = randomUUID();
    const now = new Date().toISOString();

    const db = await getDb();
    db.prepare(`
      INSERT INTO notebooks (id, user_id, title, achievement_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(notebookId, user.id, title ?? "Adsız defter", achievement_id ?? null, now, now);

    const stmt = db.prepare(`
      SELECT id, title, achievement_id, created_at, updated_at
      FROM notebooks WHERE id = ?
    `);
    const notebook = stmt.get(notebookId) as any;
    stmt.free();

    return createSuccessResponse({ notebook });
  } catch (error) {
    console.error("Create notebook error:", error);
    return createAuthError("SERVER_ERROR", "Not defteri oluşturulurken hata oluştu", 500);
  }
}