import { query, queryOne } from "../db/index";
import { v4 as uuid } from "uuid";

export type EventType =
  | "message_in"
  | "message_out"
  | "tool_call"
  | "tool_result"
  | "decision"
  | "error"
  | "heartbeat"
  | "approval_required"
  | "approved"
  | "rejected";

export interface AgentEvent {
  id: string;
  sessionId: string | null;
  occurredAt: Date;
  type: EventType;
  payload: Record<string, unknown>;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  approvedBy?: string;
  durationMs?: number;
  llmTokens?: number;
}

export interface CreateEventInput {
  sessionId?: string;
  type: EventType;
  payload?: Record<string, unknown>;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  approvedBy?: string;
  durationMs?: number;
  llmTokens?: number;
}

export async function appendEvent(
  input: CreateEventInput,
): Promise<AgentEvent> {
  const rows = await query<AgentEvent>(
    `
    INSERT INTO agent_events (
      id, session_id, type, payload,
      tool_name, tool_input, tool_output,
      approved_by, duration_ms, llm_tokens
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `,
    [
      uuid(),
      input.sessionId ?? null,
      input.type,
      JSON.stringify(input.payload ?? {}),
      input.toolName ?? null,
      input.toolInput ? JSON.stringify(input.toolInput) : null,
      input.toolOutput ? JSON.stringify(input.toolOutput) : null,
      input.approvedBy ?? null,
      input.durationMs ?? null,
      input.llmTokens ?? null,
    ],
  );

  return rows[0];
}

export async function getSessionEvents(
  sessionId: string,
  limit = 50,
): Promise<AgentEvent[]> {
  return query<AgentEvent>(
    `
    SELECT * FROM agent_events
    WHERE session_id = $1
    ORDER BY occurred_at ASC
    LIMIT $2
  `,
    [sessionId, limit],
  );
}

export async function getToolHistory(
  toolName: string,
  workspace: string,
  limit = 20,
): Promise<AgentEvent[]> {
  return query<AgentEvent>(
    `
    SELECT ae.* FROM agent_events ae
    JOIN sessions s ON s.id = ae.session_id
    WHERE ae.tool_name = $1
      AND s.workspace = $2
      AND ae.type = 'tool_result'
    ORDER BY ae.occurred_at DESC
    LIMIT $3
  `,
    [toolName, workspace, limit],
  );
}
