import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";
import { randomUUID } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  const { id } = await params;
  const { answers } = await request.json();

  if (!answers || !Array.isArray(answers)) {
    return createAuthError("VALIDATION_ERROR", "Cevaplar gerekli");
  }

  const db = await getDb();
  const questionStmt = db.prepare(`
    SELECT id, correct_answer, explanation
    FROM questions WHERE quiz_id = ?
  `);
  const questions = questionStmt.all([id]) as { id: string; correct_answer: string; explanation: string }[];
  questionStmt.free();

  if (!questions.length) {
    return createAuthError("NOT_FOUND", "Quiz soruları bulunamadı", 404);
  }

  const results = answers.map((a: { questionId: string; givenAnswer: string }) => {
    const question = questions.find(q => q.id === a.questionId);
    if (!question) return null;

    const isCorrect = question.correct_answer === a.givenAnswer;
    return {
      question_id: a.questionId,
      user_id: user!.id,
      given_answer: a.givenAnswer,
      is_correct: isCorrect ? 1 : 0,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const insertAnswer = db.prepare(`
    INSERT INTO answers (id, question_id, user_id, given_answer, is_correct)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const r of results) {
    insertAnswer.run(randomUUID(), r.question_id, r.user_id, r.given_answer, r.is_correct);
  }
  insertAnswer.free();

  const correctCount = results.filter(r => r.is_correct === 1).length;
  const totalCount = results.length;

  return createSuccessResponse({
    score: correctCount,
    total: totalCount,
    percentage: Math.round((correctCount / totalCount) * 100),
    results: results.map((r, i) => ({
      questionId: r.question_id,
      isCorrect: r.is_correct === 1,
      explanation: questions[i]?.explanation,
    })),
  });
}