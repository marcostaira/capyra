// ─── Evolution API v2 ───────────────────────────────

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
  server_url: string;
  apikey: string;
}

export interface EvolutionMessageData {
  key: {
    remoteJid: string; // phone@s.whatsapp.net
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
    };
    audioMessage?: Record<string, unknown>;
    documentMessage?: {
      caption?: string;
      fileName?: string;
    };
  };
  messageType: string;
  messageTimestamp: number;
  instanceId: string;
  source: string;
}

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
  delay?: number;
}

export interface EvolutionSendResponse {
  key: { id: string };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

// ─── Internal ──────────────────────────────────────

export interface IncomingMessage {
  instanceName: string;
  from: string; // número normalizado ex: 5544999999999
  pushName: string;
  text: string;
  messageId: string;
  timestamp: number;
}

export interface ChannelConfig {
  instanceName: string;
  apiKey: string;
  evolutionBaseUrl: string;
  gatewayUrl: string;
  gatewaySecret: string;
  webhookPort: number;
  workspace?: string;
}
