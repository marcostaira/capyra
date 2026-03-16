import { WebSocketServer, WebSocket } from "ws";
import { query } from "../db/index";
import { runAgentLoop } from "../agent/loop";
import { v4 as uuid } from "uuid";

interface GatewayClient {
  ws: WebSocket;
  sessionId: string;
  workspace: string;
  channel: string;
  channelId: string;
}

const clients = new Map<string, GatewayClient>();
const pendingApprovals = new Map<string, (approved: boolean) => void>();

export function startGateway(port = 18789): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`🦫 Capyra Gateway running on ws://localhost:${port}`);

  wss.on("connection", async (ws, _req) => {
    const clientId = uuid();

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleMessage(clientId, ws, msg);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Gateway handler error:", message);
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message },
          }),
        );
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      pendingApprovals.delete(clientId);
    });
  });

  return wss;
}

async function handleMessage(
  clientId: string,
  ws: WebSocket,
  msg: Record<string, unknown>,
): Promise<void> {
  switch (msg.type) {
    case "register": {
      const {
        channel,
        channelId,
        workspace = "default",
      } = msg.payload as Record<string, string>;

      const existing = await query<{ id: string }>(
        `
        SELECT id FROM sessions
        WHERE channel = $1 AND channel_id = $2 AND workspace = $3
        ORDER BY created_at DESC LIMIT 1
      `,
        [channel, channelId, workspace],
      );

      let sessionId: string;

      if (existing.length > 0) {
        sessionId = existing[0].id;
      } else {
        const rows = await query<{ id: string }>(
          `
          INSERT INTO sessions (id, channel, channel_id, workspace)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
          [uuid(), channel, channelId, workspace],
        );
        sessionId = rows[0].id;
      }

      clients.set(clientId, { ws, sessionId, workspace, channel, channelId });

      ws.send(
        JSON.stringify({
          type: "registered",
          payload: { sessionId, workspace },
        }),
      );
      break;
    }

    case "message": {
      const client = clients.get(clientId);
      if (!client) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Not registered. Send register first." },
          }),
        );
        return;
      }

      const { content } = msg.payload as { content: string };

      ws.send(JSON.stringify({ type: "ack", payload: { content } }));

      const { SapB1Skill } = require("@capyra/skill-sap-b1");
      const skills = [];

      if (process.env.SAP_BASE_URL) {
        skills.push(
          new SapB1Skill({
            baseUrl: process.env.SAP_BASE_URL,
            companyDB: process.env.SAP_COMPANY_DB,
            username: process.env.SAP_USERNAME,
            password: process.env.SAP_PASSWORD,
            verifySsl: process.env.SAP_VERIFY_SSL === "true",
          }),
        );
      }

      await runAgentLoop(
        {
          sessionId: client.sessionId,
          workspace: client.workspace,
          skills,
          llmProvider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai",
          onMessage: async (text) => {
            ws.send(
              JSON.stringify({
                type: "message",
                payload: { content: text },
              }),
            );
          },
          onApprovalRequired: async (toolName, params) => {
            ws.send(
              JSON.stringify({
                type: "approval_required",
                payload: { toolName, params },
              }),
            );

            return new Promise((resolve) => {
              // registra o resolver aguardando approval_response
              pendingApprovals.set(clientId, resolve);

              // timeout de 60s
              setTimeout(() => {
                if (pendingApprovals.has(clientId)) {
                  pendingApprovals.delete(clientId);
                  resolve(false);
                }
              }, 60000);
            });
          },
        },
        content,
      );
      break;
    }

    case "approval_response": {
      const resolver = pendingApprovals.get(clientId);
      if (resolver) {
        pendingApprovals.delete(clientId);
        resolver((msg.payload as Record<string, unknown>).approved === true);
      }
      break;
    }

    default:
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: `Unknown message type: ${msg.type}` },
        }),
      );
  }
}
