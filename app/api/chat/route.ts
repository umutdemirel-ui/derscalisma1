import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";
import { getOpenAI } from "@/lib/openai";
import { embedText } from "@/lib/embeddings";

const MOCK_USER_ID = "anonymous-user";

export async function POST(request: NextRequest) {
  const { user } = await requireAuth(request);

  try {
    const { notebookId, question } = await request.json();

    if (!notebookId || !question) {
      return createAuthError("VALIDATION_ERROR", "Not defteri ID ve soru gerekli");
    }

    const openai = getOpenAI();
    if (!openai) {
      return createAuthError("SERVER_ERROR", "OpenAI API key not configured", 503);
    }

    const db = await getDb();
    const stmt = db.prepare(`
      SELECT id FROM notebooks WHERE id = ? AND user_id = ?
    `);
    const notebook = stmt.get([notebookId, user.id]) as any;
    stmt.free();

    if (!notebook) {
      return createAuthError("NOT_FOUND", "Not defteri bulunamadı", 404);
    }

    const embedding = await embedText(question);

    const chunkStmt = db.prepare(`
      SELECT c.content
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.notebook_id = ? AND c.embedding IS NOT NULL
      LIMIT 6
    `);
    const chunks = chunkStmt.all([notebookId]) as { content: string }[];
    chunkStmt.free();

    const context = chunks.map(c => c.content).join("\n\n---\n\n");

    if (!context.trim()) {
      return createSuccessResponse({
        answer: "Bu not defterinde henüz işlenmiş materyal yok. Önce dosya yükleyip embedding'lerin oluşturulmasını bekleyin."
      });
    }

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Sen bir ders çalışma asistanısın. SADECE verilen materyale dayanarak cevap ver. Materyalde yoksa 'Materyalde bu bilgi yok' de. Türkçe, öğrenci seviyesinde, markdown formatında anlat."
        },
        {
          role: "user",
          content: `Ders materyali:\n${context}\n\nSoru: ${question}`
        },
      ],
    });

    return createSuccessResponse({ answer: aiResponse.choices[0].message.content });
  } catch (error) {
    console.error("Chat error:", error);
    return createAuthError("SERVER_ERROR", "Sohbet sırasında bir hata oluştu", 500);
  }
}