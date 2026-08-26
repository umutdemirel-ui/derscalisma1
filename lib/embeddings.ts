const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ?? "voyage";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function embedText(text: string): Promise<number[]> {
  const embeddings = await embedTexts([text]);
  return embeddings[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
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
        input_type: "query",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage API error: ${response.statusText} - ${error}`);
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
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  throw new Error(
    "Embedding provider not configured. Set EMBEDDING_PROVIDER (voyage|openai) and corresponding API key."
  );
}