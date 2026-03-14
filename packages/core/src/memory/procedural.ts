import { query, queryOne } from "../db/index";
import { v4 as uuid } from "uuid";

export interface ProceduralMemory {
  id: string;
  workspace: string;
  key: string;
  value: string;
  confidence: number;
  source?: string;
  updatedAt: Date;
}

export async function remember(
  workspace: string,
  key: string,
  value: string,
  source?: string,
  confidence = 1.0,
): Promise<ProceduralMemory> {
  const rows = await query<ProceduralMemory>(
    `
    INSERT INTO memory_procedural (id, workspace, key, value, confidence, source)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (workspace, key)
    DO UPDATE SET
      value = EXCLUDED.value,
      confidence = EXCLUDED.confidence,
      source = EXCLUDED.source,
      updated_at = NOW()
    RETURNING *
  `,
    [uuid(), workspace, key, value, confidence, source ?? null],
  );

  return rows[0];
}

export async function recall(
  workspace: string,
  key: string,
): Promise<ProceduralMemory | null> {
  return queryOne<ProceduralMemory>(
    `
    SELECT * FROM memory_procedural
    WHERE workspace = $1 AND key = $2
  `,
    [workspace, key],
  );
}

export async function recallAll(
  workspace: string,
): Promise<ProceduralMemory[]> {
  return query<ProceduralMemory>(
    `
    SELECT * FROM memory_procedural
    WHERE workspace = $1
    ORDER BY updated_at DESC
  `,
    [workspace],
  );
}

export async function weaken(
  workspace: string,
  key: string,
  amount = 0.2,
): Promise<void> {
  await query(
    `
    UPDATE memory_procedural
    SET confidence = GREATEST(0, confidence - $3),
        updated_at = NOW()
    WHERE workspace = $1 AND key = $2
  `,
    [workspace, key, amount],
  );
}
