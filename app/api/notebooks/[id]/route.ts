import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";

const MOCK_USER_ID = "anonymous-user";

async function checkNotebookOwnership(db: any, notebookId: string, userId: string) {
  const stmt = db.prepare(`
    SELECT id FROM notebooks WHERE id = ? AND user_id = ?
  `);
  const result = stmt.get(notebookId, userId) as any;
  stmt.free();
  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAuth(request);

  const { id } = await params;
  const db = await getDb();

  const notebook = await checkNotebookOwnership(db, id, user.id);
  if (!notebook) {
    return createAuthError("NOT_FOUND", "Not defteri bulunamadı", 404);
  }

  const stmt = db.prepare(`
    SELECT id, title, achievement_id, created_at, updated_at
    FROM notebooks WHERE id = ?
  `);
  const fullNotebook = stmt.get(id) as any;
  stmt.free();

  return createSuccessResponse({ notebook: fullNotebook });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAuth(request);

  const { id } = await params;
  const db = await getDb();
  const notebook = await checkNotebookOwnership(db, id, user.id);
  if (!notebook) {
    return createAuthError("NOT_FOUND", "Not defteri bulunamadı", 404);
  }

  try {
    const { title, achievement_id } = await request.json();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE notebooks
      SET title = COALESCE(?, title), achievement_id = COALESCE(?, achievement_id), updated_at = ?
      WHERE id = ?
    `).run(title ?? null, achievement_id ?? null, now, id);

    const stmt = db.prepare(`
      SELECT id, title, achievement_id, created_at, updated_at
      FROM notebooks WHERE id = ?
    `);
    const updated = stmt.get(id) as any;
    stmt.free();

    return createSuccessResponse({ notebook: updated });
  } catch (error) {
    console.error("Update notebook error:", error);
    return createAuthError("SERVER_ERROR", "Not defteri güncellenirken hata oluştu", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAuth(request);

  const { id } = await params;
  const db = await getDb();
  const notebook = await checkNotebookOwnership(db, id, user.id);
  if (!notebook) {
    return createAuthError("NOT_FOUND", "Not defteri bulunamadı", 404);
  }

  db.prepare("DELETE FROM notebooks WHERE id = ?").run(id);

  return createSuccessResponse({ success: true });
}