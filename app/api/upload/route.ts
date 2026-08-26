import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";
import { randomUUID } from "crypto";

function chunkText(text: string, maxChunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + maxChunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const notebookId = formData.get("notebookId") as string;

    if (!file || !notebookId) {
      return createAuthError("VALIDATION_ERROR", "Dosya ve not defteri ID gerekli");
    }

    const db = await getDb();
    const stmt = db.prepare(`
      SELECT id FROM notebooks WHERE id = ? AND user_id = ?
    `);
    const notebook = stmt.get(notebookId, user!.id) as any;
    stmt.free();

    if (!notebook) {
      return createAuthError("NOT_FOUND", "Not defteri bulunamadı", 404);
    }

    let rawText = "";
    let fileType = "text";

    if (file.type === "application/pdf") {
      fileType = "pdf";
      const arrayBuffer = await file.arrayBuffer();
      rawText = `[PDF dosyası: ${file.name}]\n\nNot: PDF metin çıkarma henüz aktif değil. Gerçek implementasyonda pdf-parse kütüphanesi kullanılmalı.`;
    } else if (file.type.startsWith("text/")) {
      fileType = "text";
      rawText = await file.text();
    } else if (file.type.startsWith("image/")) {
      fileType = "image";
      rawText = `[Görsel dosyası: ${file.name}]\n\nNot: OCR henüz aktif değil. Gerçek implementasyonda Tesseract.js veya cloud OCR kullanılmalı.`;
    } else {
      return createAuthError("VALIDATION_ERROR", "Desteklenmeyen dosya türü");
    }

    const documentId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO documents (id, notebook_id, file_type, file_name, raw_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(documentId, notebookId, fileType, file.name, rawText, now);

    const chunks = chunkText(rawText);
    const insertChunk = db.prepare(`
      INSERT INTO chunks (id, document_id, content, chunk_index, embedding)
      VALUES (?, ?, ?, ?, NULL)
    `);

    for (let i = 0; i < chunks.length; i++) {
      insertChunk.run(randomUUID(), documentId, chunks[i], i);
    }
    insertChunk.free();

    return createSuccessResponse({
      document: { id: documentId, file_name: file.name },
      chunksCreated: chunks.length,
      message: "Dosya yüklendi. Embedding'ler arka planda işlenecek.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return createAuthError("SERVER_ERROR", "Dosya yüklenirken hata oluştu", 500);
  }
}