import "dotenv/config";
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

// valida config obrigatória
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

// ─── Sender ────────────────────────────────────────

const sender = new WhatsAppSender(
  config.evolutionBaseUrl,
  config.instanceName,
  config.apiKey,
);

// ─── Gateway clients por número ────────────────────
// cada número tem seu próprio cliente Gateway
// para manter sessões isoladas

const gatewayClients = new Map<string, GatewayClient>();

async function getOrCreateGatewayClient(
  from: string,
  pushName: string,
): Promise<GatewayClient> {
  if (gatewayClients.has(from)) {
    return gatewayClients.get(from)!;
  }

  const client = new GatewayClient(config.gatewayUrl, config.gatewaySecret);

  // quando o agente responder, envia pro WhatsApp
  client.on("agent_message", async (payload) => {
    const text = payload.content as string;
    try {
      await sender.sendText(from, text);
    } catch (err) {
      logger.error("Failed to send WhatsApp message", { from, err });
    }
  });

  // quando o agente precisar de aprovação
  client.on("approval_required", async (payload) => {
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
  gatewayClients.set(from, client);
  return client;
}

// ─── Handler de mensagens recebidas ────────────────

async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  const client = await getOrCreateGatewayClient(msg.from, msg.pushName);

  // aguarda conexão se necessário
  if (!client.isConnected()) {
    await waitForConnection(client);
  }

  // verifica se é resposta de aprovação
  const lower = msg.text.toLowerCase().trim();
  if (["sim", "yes", "s", "y", "confirmar", "confirm", "ok"].includes(lower)) {
    client.approveToolCall(true);
    return;
  }

  if (["não", "nao", "no", "n", "cancelar", "cancel"].includes(lower)) {
    client.approveToolCall(false);
    return;
  }

  // mensagem normal para o agente
  client.sendMessage(msg.text);
}

// ─── Helpers ───────────────────────────────────────

function buildApprovalMessage(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const lines = [
    `⚠️ *Action required*`,
    ``,
    `The agent wants to execute: *${toolName}*`,
    ``,
    `Parameters:`,
    "```",
    JSON.stringify(params, null, 2),
    "```",
    ``,
    `Reply *yes* to confirm or *no* to cancel.`,
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

    client.once("connected", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ─── Start ─────────────────────────────────────────

logger.info("🦫 Capyra WhatsApp Channel starting...");
logger.info(`Instance: ${config.instanceName}`);
logger.info(`Gateway: ${config.gatewayUrl}`);

createWebhookServer(handleIncomingMessage, config.webhookPort);
