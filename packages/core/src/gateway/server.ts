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

export function startGateway(port = 18789): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`🦫 Capyra Gateway running on ws://localhost:${port}`);

  wss.on("connection", async (ws, req) => {
    const clientId = uuid();

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleMessage(clientId, ws, msg);
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Invalid message format" },
          }),
        );
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
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

      // cria ou recupera sessão
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

      // confirma recebimento
      ws.send(JSON.stringify({ type: "ack", payload: { content } }));

      // skills carregadas dinamicamente (simplificado por ora)
      const { SapB1Skill } = require("../../skills/sap-b1/index");
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
            // envia para o canal e aguarda resposta
            ws.send(
              JSON.stringify({
                type: "approval_required",
                payload: { toolName, params },
              }),
            );

            return new Promise((resolve) => {
              const handler = (raw: Buffer) => {
                const response = JSON.parse(raw.toString());
                if (response.type === "approval_response") {
                  ws.off("message", handler);
                  resolve(response.payload.approved === true);
                }
              };
              ws.on("message", handler);
              // timeout de 60s
              setTimeout(() => {
                ws.off("message", handler);
                resolve(false);
              }, 60000);
            });
          },
        },
        content,
      );

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
