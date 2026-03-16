import https from "https";
import { SapB1Config, SapSession, SapQueryResult } from "./types.js";

export class SapB1Client {
  private config: SapB1Config;
  private session: SapSession | null = null;
  private cookies: string[] = [];
  private renewTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: SapB1Config) {
    this.config = config;
  }

  private get agent() {
    return new https.Agent({
      rejectUnauthorized: this.config.verifySsl ?? false,
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.cookies.length > 0) {
      headers["Cookie"] = this.cookies.join("; ");
    }

    const { Agent } = require("undici");

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // @ts-ignore
      dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("SAP B1 RAW ERROR:", error);
      throw new Error(`SAP B1 error ${response.status}: ${error}`);
    }

    // captura cookies de sessão
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      this.cookies = setCookie.map((c: string) => c.split(";")[0]);
    }

    if (response.status === 204) return {} as T;

    return response.json() as Promise<T>;
  }

  async login(): Promise<void> {
    // cancela timer anterior se existir
    this.clearRenewTimer();

    const result = await this.request<{ SessionId: string }>("POST", "/Login", {
      CompanyDB: this.config.companyDB,
      UserName: this.config.username,
      Password: this.config.password,
    });

    this.session = {
      sessionId: result.SessionId,
      expiresAt: new Date(Date.now() + 28 * 60 * 1000), // renova em 28min (antes dos 30min do SAP)
    };

    // agenda renovação automática em 25 minutos
    this.scheduleRenew();

    console.log(`[SAP B1] Session started — renews in 25min`);
  }

  async logout(): Promise<void> {
    this.clearRenewTimer();
    try {
      await this.request("POST", "/Logout");
    } finally {
      this.session = null;
      this.cookies = [];
    }
  }

  private isSessionValid(): boolean {
    if (!this.session) return false;
    return new Date() < this.session.expiresAt;
  }

  async ensureSession(): Promise<void> {
    if (!this.isSessionValid()) {
      console.log("[SAP B1] Session expired or missing — logging in");
      await this.login();
    }
  }

  private scheduleRenew(): void {
    this.clearRenewTimer();

    // renova 5 minutos antes de expirar (25min após login)
    const renewIn = 25 * 60 * 1000;

    this.renewTimer = setTimeout(async () => {
      console.log("[SAP B1] Renewing session proactively...");
      try {
        await this.login();
        console.log("[SAP B1] Session renewed successfully");
      } catch (err) {
        console.error("[SAP B1] Session renewal failed:", err);
        this.session = null;
        this.cookies = [];
      }
    }, renewIn);
  }

  private clearRenewTimer(): void {
    if (this.renewTimer) {
      clearTimeout(this.renewTimer);
      this.renewTimer = null;
    }
  }

  async query(sql: string): Promise<SapQueryResult> {
    await this.ensureSession();

    // gera um código único para a query
    const queryCode = `CQ_${Date.now()}`;

    // cria a query
    await this.request("POST", "/SQLQueries", {
      SqlCode: queryCode,
      SqlText: sql,
    });

    // executa
    const result = await this.request<SapQueryResult>(
      "POST",
      `/SQLQueries('${queryCode}')/List`,
    );

    // limpa a query criada
    try {
      await this.request("DELETE", `/SQLQueries('${queryCode}')`);
    } catch {}

    return result;
  }

  async get<T>(resource: string, params?: Record<string, string>): Promise<T> {
    await this.ensureSession();
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<T>("GET", `/${resource}${qs}`);
  }

  async post<T>(resource: string, body: unknown): Promise<T> {
    await this.ensureSession();
    return this.request<T>("POST", `/${resource}`, body);
  }

  async patch(
    resource: string,
    id: string | number,
    body: unknown,
  ): Promise<void> {
    await this.ensureSession();
    await this.request("PATCH", `/${resource}(${id})`, body);
  }

  async delete(resource: string, id: string | number): Promise<void> {
    await this.ensureSession();
    await this.request("DELETE", `/${resource}(${id})`);
  }
}
