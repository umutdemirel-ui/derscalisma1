import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthError, createSuccessResponse } from "@/lib/api/middleware";
import { getDb } from "@/lib/db/database";
import { embedText } from "@/lib/embeddings";

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ?? "voyage";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (EMBEDDING_PROVIDER === "voyage" && VOYAGE_API_KEY) {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "voyage-3-large",
        input: texts,
        input_type: "document",
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  if (EMBEDDING_PROVIDER === "openai" && OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  throw new Error("Embedding provider not configured");
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { chunkIds } = await request.json();
    const db = await getDb();

    let chunks: any[];
    if (chunkIds && chunkIds.length > 0) {
      const placeholders = chunkIds.map(() => "?").join(",");
      const stmt = db.prepare(`
        SELECT id, content FROM chunks
        WHERE id IN (${placeholders}) AND embedding IS NULL
        ORDER BY created_at ASC LIMIT 50
      `);
      chunks = stmt.all(...chunkIds) as any[];
      stmt.free();
    } else {
      const stmt = db.prepare(`
        SELECT id, content FROM chunks
        WHERE embedding IS NULL
        ORDER BY created_at ASC LIMIT 50
      `);
      chunks = stmt.all() as any[];
      stmt.free();
    }

    if (!chunks || chunks.length === 0) {
      return createSuccessResponse({ processed: 0, message: "İşlenecek chunk yok" });
    }

    const texts = chunks.map((c: any) => c.content);
    const embeddings = await generateEmbeddings(texts);

    const updateChunk = db.prepare("UPDATE chunks SET embedding = ? WHERE id = ?");
    for (let i = 0; i < chunks.length; i++) {
      updateChunk.run(JSON.stringify(embeddings[i]), chunks[i].id);
    }
    updateChunk.free();

    return createSuccessResponse({ processed: chunks.length });
  } catch (error) {
    console.error("Embedding error:", error);
    return createAuthError("SERVER_ERROR", String(error), 500);
  }
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  const db = await getDb();
  const stmt = db.prepare(`
    SELECT COUNT(*) as c FROM chunks WHERE embedding IS NULL
  `);
  const count = stmt.get() as { c: number };
  stmt.free();

  return createSuccessResponse({ pendingChunks: count.c });
}