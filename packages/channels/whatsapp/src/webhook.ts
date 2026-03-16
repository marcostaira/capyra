import express, { Request, Response } from "express";
import { EvolutionWebhookPayload, IncomingMessage } from "./types";
import { logger } from "./logger";

export function createWebhookServer(
  onMessage: (msg: IncomingMessage) => Promise<void>,
  port: number,
): void {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Evolution API v2 envia tudo nessa rota
  app.post(
    ["/webhook", "/webhook/messages-upsert"],
    async (req: Request, res: Response) => {
      res.status(200).json({ received: true });

      try {
        const payload = req.body as EvolutionWebhookPayload;

        // filtra apenas mensagens recebidas
        if (payload.event !== "messages.upsert") return;
        if (!payload.data) return;

        const { key, message, pushName, messageTimestamp } = payload.data;

        // ignora mensagens enviadas pelo próprio bot
        if (key.fromMe) return;

        // extrai texto da mensagem
        const text = extractText(message);
        if (!text) {
          logger.debug("Ignoring non-text message", {
            type: payload.data.messageType,
          });
          return;
        }

        // normaliza o número
        const from = normalizeJid(key.remoteJid, (key as any).remoteJidAlt);

        const incoming: IncomingMessage = {
          instanceName: payload.instance,
          from,
          pushName: pushName ?? from,
          text: text.trim(),
          messageId: key.id,
          timestamp: messageTimestamp,
        };

        logger.info("Message received", {
          from: maskPhone(incoming.from),
          name:
            process.env.DEMO_MODE === "true" ? "John Smith" : incoming.pushName,
          preview: text.substring(0, 50),
        });

        await onMessage(incoming);
      } catch (err) {
        logger.error("Webhook processing error", { err });
      }
    },
  );

  app.post(
    [
      "/webhook/contacts-update",
      "/webhook/contacts-upsert",
      "/webhook/chats-update",
      "/webhook/presence-update",
      "/webhook/messages-update",
      "/webhook/send-message",
    ],
    (_req: Request, res: Response) => {
      res.status(200).json({ received: true });
    },
  );

  // health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "capyra-whatsapp" });
  });

  app.listen(port, () => {
    logger.info(`WhatsApp webhook listening on port ${port}`);
  });
}

function extractText(
  message?: EvolutionWebhookPayload["data"]["message"],
): string | null {
  if (!message) return null;

  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.documentMessage?.caption ??
    null
  );
}

function normalizeJid(jid: string, jidAlt?: string): string {
  // se for LID (novo sistema Meta), usa o JID alternativo
  if (jid.endsWith("@lid") && jidAlt) {
    return jidAlt.split("@")[0];
  }
  return jid.split("@")[0];
}

function maskPhone(phone: string): string {
  if (phone.length < 8) return "***";
  return phone.substring(0, 5) + "*****" + phone.substring(phone.length - 1);
}
