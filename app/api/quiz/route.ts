import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";
import { embedText } from "@/lib/embeddings";
import { randomUUID } from "crypto";
import { getOpenAI } from "@/lib/openai";

const MOCK_USER_ID = "anonymous-user";

export async function POST(request: NextRequest) {
  const { user } = await requireAuth(request);

  try {
    const { notebookId, questionCount = 5 } = await request.json();

    if (!notebookId) {
      return createAuthError("VALIDATION_ERROR", "Notebook ID gerekli");
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

    const chunkStmt = db.prepare(`
      SELECT c.content FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.notebook_id = ? AND c.embedding IS NOT NULL
      LIMIT 20
    `);
    const chunks = chunkStmt.all([notebookId]) as { content: string }[];
    chunkStmt.free();

    const allContent = chunks.map(c => c.content).join("\n\n");

    if (!allContent.trim()) {
      return createAuthError("VALIDATION_ERROR", "Bu not defterinde quiz oluşturmak için yeterli materyal yok", 400);
    }

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 3000,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `Sen bir eğitim uzmanısın. Verilen ders materyalinden öğrenciler için quiz soruları üret. Her soru çoktan seçmeli olmalı (4 şık), doğru cevap ve açıklama içermeli. Cevabı SADECE JSON formatında ver:
{
  "questions": [
    {
      "prompt": "Soru metni",
      "options": ["A) Şık 1", "B) Şık 2", "C) Şık 3", "D) Şık 4"],
      "correct_answer": "A",
      "explanation": "Neden doğru olduğunu açıklama"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Ders materyali:\n${allContent.slice(0, 15000)}\n\n${questionCount} adet çoktan seçmeli quiz sorusu üret.`
        }
      ],
    });

    const content = aiResponse.choices[0].message.content;
    let quizData;
    try {
      quizData = JSON.parse(content || "{}");
    } catch {
      return createAuthError("SERVER_ERROR", "Quiz formatı parse edilemedi", 500);
    }

    const quizId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO quizzes (id, notebook_id, status, created_at)
      VALUES (?, ?, 'ready', ?)
    `).run(quizId, notebookId, now);

    const insertQuestion = db.prepare(`
      INSERT INTO questions (id, quiz_id, prompt, options, correct_answer, explanation)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const q of quizData.questions) {
      insertQuestion.run(randomUUID(), quizId, q.prompt, JSON.stringify(q.options), q.correct_answer, q.explanation);
    }
    insertQuestion.free();

    return createSuccessResponse({ quizId, questionCount: quizData.questions.length });
  } catch (error) {
    console.error("Quiz generation error:", error);
    return createAuthError("SERVER_ERROR", String(error), 500);
  }
}

export async function GET(request: NextRequest) {
  const { user } = await requireAuth(request);

  const { searchParams } = new URL(request.url);
  const notebookId = searchParams.get("notebookId");

  if (!notebookId) {
    return createAuthError("VALIDATION_ERROR", "Notebook ID gerekli");
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

  const quizStmt = db.prepare(`
    SELECT q.id, q.status, q.created_at,
           json_group_array(
             json_object(
               'id', qu.id,
               'prompt', qu.prompt,
               'options', qu.options,
               'correct_answer', qu.correct_answer,
               'explanation', qu.explanation
             )
           ) as questions
    FROM quizzes q
    LEFT JOIN questions qu ON qu.quiz_id = q.id
    WHERE q.notebook_id = ?
    GROUP BY q.id
    ORDER BY q.created_at DESC
  `);
  const quizzes = quizStmt.all([notebookId]) as any[];
  quizStmt.free();

  return createSuccessResponse({ quizzes });
}