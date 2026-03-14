import { query } from "../db/index";
import { v4 as uuid } from "uuid";

export interface EpisodicMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: Date;
}

export async function appendMessage(
  sessionId: string,
  role: EpisodicMessage["role"],
  content: string,
  eventId?: string,
): Promise<EpisodicMessage> {
  const rows = await query<EpisodicMessage>(
    `
    INSERT INTO memory_episodic (id, session_id, role, content, event_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
    [uuid(), sessionId, role, content, eventId ?? null],
  );

  return rows[0];
}

export async function getRecentMessages(
  sessionId: string,
  limit = 20,
): Promise<EpisodicMessage[]> {
  return query<EpisodicMessage>(
    `
    SELECT * FROM memory_episodic
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [sessionId, limit],
  ).then((rows) => rows.reverse());
}
