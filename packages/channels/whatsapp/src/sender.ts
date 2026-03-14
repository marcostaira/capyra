import { EvolutionSendTextPayload, EvolutionSendResponse } from "./types";
import { logger } from "./logger";

export class WhatsAppSender {
  private baseUrl: string;
  private instanceName: string;
  private apiKey: string;

  constructor(baseUrl: string, instanceName: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.instanceName = instanceName;
    this.apiKey = apiKey;
  }

  async sendText(to: string, text: string): Promise<void> {
    // Evolution v2 suporta chunks para mensagens longas
    const chunks = this.splitMessage(text);

    for (const chunk of chunks) {
      await this.sendChunk(to, chunk);
      // delay entre chunks para não parecer robótico
      if (chunks.length > 1) {
        await sleep(500);
      }
    }
  }

  private async sendChunk(to: string, text: string): Promise<void> {
    const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

    const payload: EvolutionSendTextPayload = {
      number: to,
      text,
      delay: 1000,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Evolution API error ${response.status}: ${body}`);
    }

    const result = (await response.json()) as EvolutionSendResponse;
    logger.debug("Message sent", { to, messageId: result.key?.id });
  }

  // WhatsApp tem limite de ~65k chars, mas na prática
  // mensagens muito longas são ruins para UX
  private splitMessage(text: string, maxLength = 4000): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    const lines = text.split("\n");
    let current = "";

    for (const line of lines) {
      if ((current + "\n" + line).length > maxLength) {
        if (current) chunks.push(current.trim());
        current = line;
      } else {
        current = current ? current + "\n" + line : line;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
