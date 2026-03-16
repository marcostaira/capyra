import WebSocket from "ws";
import { EventEmitter } from "events";
import { logger } from "./logger";

export interface GatewayMessage {
  type: string;
  payload: Record<string, unknown>;
}

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private secret: string;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();

  constructor(url: string, secret: string) {
    super();
    this.url = url;
    this.secret = secret;
  }
  private registered = false;

  connect(): void {
    logger.info(`Connecting to Gateway: ${this.url}`);

    this.registered = false;
    this.ws = new WebSocket(this.url, {
      headers: { "x-capyra-secret": this.secret },
    });

    this.ws.on("open", () => {
      logger.info("Connected to Capyra Gateway");
      this.reconnectDelay = 2000;
      this.emit("connected");
    });

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as GatewayMessage;
        this.handleGatewayMessage(msg);
      } catch (err) {
        logger.error("Failed to parse gateway message", { err });
      }
    });

    this.ws.on("close", () => {
      logger.warn("Disconnected from Gateway");
      this.emit("disconnected");
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      logger.error("Gateway WebSocket error", { err: err.message });
    });
  }

  private handleGatewayMessage(msg: GatewayMessage): void {
    switch (msg.type) {
      case "registered":
        this.registered = true;
        this.emit("registered", msg.payload);
        break;

      case "message":
        // resposta do agente para o usuário
        this.emit("agent_message", msg.payload);
        break;

      case "approval_required":
        // agente quer executar uma tool que precisa de aprovação
        this.emit("approval_required", msg.payload);
        break;

      case "ack":
        logger.debug("Message acknowledged by gateway");
        break;

      case "error":
        logger.error("Gateway error", msg.payload);
        break;

      default:
        logger.debug("Unknown gateway message", { type: msg.type });
    }
  }

  register(opts: {
    channel: string;
    channelId: string;
    workspace: string;
  }): void {
    this.send({ type: "register", payload: opts });
  }

  sendMessage(content: string): void {
    this.send({ type: "message", payload: { content } });
  }

  approveToolCall(approved: boolean): void {
    this.send({
      type: "approval_response",
      payload: { approved },
    });
  }

  private send(msg: GatewayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      logger.warn("Cannot send — gateway not connected", { type: msg.type });
    }
  }

  private scheduleReconnect(): void {
    logger.info(`Reconnecting in ${this.reconnectDelay}ms...`);
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay,
    );
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.registered;
  }
}
