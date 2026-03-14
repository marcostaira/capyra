import { query } from "../db/index";
import { v4 as uuid } from "uuid";

export interface SemanticFact {
  id: string;
  workspace: string;
  content: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

async function getEmbedding(text: string): Promise<number[]> {
  // usa OpenAI text-embedding-3-small (1536 dims, barato)
  const OpenAI = require("openai");
  const client = new OpenAI.default();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

export async function storeFact(
  workspace: string,
  content: string,
  source?: string,
  metadata?: Record<string, unknown>,
): Promise<SemanticFact> {
  const embedding = await getEmbedding(content);

  const rows = await query<SemanticFact>(
    `
    INSERT INTO memory_semantic (id, workspace, content, source, embedding, metadata)
    VALUES ($1, $2, $3, $4, $5::vector, $6)
    RETURNING id, workspace, content, source, metadata, created_at as "createdAt"
  `,
    [
      uuid(),
      workspace,
      content,
      source ?? null,
      JSON.stringify(embedding),
      JSON.stringify(metadata ?? {}),
    ],
  );

  return rows[0];
}

export async function searchFacts(
  workspace: string,
  query_text: string,
  limit = 5,
): Promise<SemanticFact[]> {
  const embedding = await getEmbedding(query_text);

  return query<SemanticFact>(
    `
    SELECT id, workspace, content, source, metadata, created_at as "createdAt",
           1 - (embedding <=> $1::vector) as similarity
    FROM memory_semantic
    WHERE workspace = $2
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `,
    [JSON.stringify(embedding), workspace, limit],
  );
}
