import dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { createWebhookServer } from "./webhook";
import { GatewayClient } from "./gateway-client";
import { WhatsAppSender } from "./sender";
import { ChannelConfig, IncomingMessage } from "./types";
import { logger } from "./logger";

// ─── Configuração ─────────────────────────────────

const config: ChannelConfig = {
  instanceName: process.env.EVOLUTION_INSTANCE!,
  apiKey: process.env.EVOLUTION_API_KEY!,
  evolutionBaseUrl: process.env.EVOLUTION_BASE_URL!,
  gatewayUrl: process.env.GATEWAY_URL!,
  gatewaySecret: process.env.GATEWAY_SECRET!,
  webhookPort: parseInt(process.env.WEBHOOK_PORT ?? "3001"),
  workspace: process.env.WORKSPACE ?? "default",
};

const required = [
  "EVOLUTION_INSTANCE",
  "EVOLUTION_API_KEY",
  "EVOLUTION_BASE_URL",
  "GATEWAY_URL",
  "GATEWAY_SECRET",
];

for (const key of required) {
  if (!process.env[key]) {
    logger.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── Sender ───────────────────────────────────────

const sender = new WhatsAppSender(
  config.evolutionBaseUrl,
  config.instanceName,
  config.apiKey,
);

// ─── Gateway clients por número ───────────────────

const gatewayClients = new Map<string, GatewayClient>();

interface ManagedClient {
  client: GatewayClient;
  hasPendingApproval: () => boolean;
  clearPendingApproval: () => void;
}

async function getOrCreateGatewayClient(
  from: string,
  pushName: string,
): Promise<ManagedClient> {
  const existing = gatewayClients.get(from);
  if (existing) {
    return existing as unknown as ManagedClient;
  }

  const client = new GatewayClient(config.gatewayUrl, config.gatewaySecret);
  let pendingApproval = false;

  client.on("agent_message", async (payload) => {
    const text = payload.content as string;
    try {
      await sender.sendText(from, text);
    } catch (err) {
      logger.error("Failed to send WhatsApp message", {
        from,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  client.on("approval_required", async (payload) => {
    pendingApproval = true;
    const { toolName, params } = payload as {
      toolName: string;
      params: Record<string, unknown>;
    };
    const confirmText = buildApprovalMessage(toolName, params);
    try {
      await sender.sendText(from, confirmText);
    } catch (err) {
      logger.error("Failed to send approval request", { from, err });
    }
  });

  client.on("connected", () => {
    client.register({
      channel: "whatsapp",
      channelId: from,
      workspace: config.workspace ?? "default",
    });
  });

  client.on("disconnected", () => {
    logger.warn("Gateway disconnected for user", { from });
  });

  client.connect();

  const managed: ManagedClient = {
    client,
    hasPendingApproval: () => pendingApproval,
    clearPendingApproval: () => {
      pendingApproval = false;
    },
  };

  gatewayClients.set(from, managed as unknown as GatewayClient);
  return managed;
}

// ─── Handler de mensagens recebidas ───────────────

async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  const managed = await getOrCreateGatewayClient(msg.from, msg.pushName);
  const { client } = managed;

  if (!client.isConnected()) {
    await waitForConnection(client);
  }

  const lower = msg.text.toLowerCase().trim();
  const isApproval = [
    "sim",
    "yes",
    "s",
    "y",
    "confirmar",
    "confirm",
    "ok",
  ].includes(lower);
  const isRejection = ["não", "nao", "no", "n", "cancelar", "cancel"].includes(
    lower,
  );

  if ((isApproval || isRejection) && managed.hasPendingApproval()) {
    managed.clearPendingApproval();
    client.approveToolCall(isApproval);
    return;
  }

  client.sendMessage(msg.text);
}

// ─── Helpers ──────────────────────────────────────

function buildApprovalMessage(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const lines = [
    `⚠️ *Confirmação necessária*`,
    ``,
    `O agente quer executar: *${toolName}*`,
    ``,
    `Parâmetros:`,
    "```",
    JSON.stringify(params, null, 2),
    "```",
    ``,
    `Responda *sim* para confirmar ou *não* para cancelar.`,
  ];
  return lines.join("\n");
}

function waitForConnection(
  client: GatewayClient,
  timeoutMs = 10000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (client.isConnected()) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("Gateway connection timeout"));
    }, timeoutMs);

    client.once("registered", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ─── Start ────────────────────────────────────────

logger.info("🦫 Capyra WhatsApp Channel starting...");
logger.info(`Instance: ${config.instanceName}`);
logger.info(`Gateway: ${config.gatewayUrl}`);

createWebhookServer(handleIncomingMessage, config.webhookPort);
