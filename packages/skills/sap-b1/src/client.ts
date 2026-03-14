import https from "https";
import { SapB1Config, SapSession, SapQueryResult } from "./types.js";

export class SapB1Client {
  private config: SapB1Config;
  private session: SapSession | null = null;
  private cookies: string[] = [];

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

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // @ts-ignore
      agent: this.agent,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SAP B1 error ${response.status}: ${error}`);
    }

    // captura cookies de sessão
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      this.cookies = setCookie.map((c) => c.split(";")[0]);
    }

    if (response.status === 204) return {} as T;

    return response.json() as Promise<T>;
  }

  async login(): Promise<void> {
    const result = await this.request<{ SessionId: string }>("POST", "/Login", {
      CompanyDB: this.config.companyDB,
      UserName: this.config.username,
      Password: this.config.password,
    });

    this.session = {
      sessionId: result.SessionId,
      expiresAt: new Date(Date.now() + 25 * 60 * 1000), // 25 min
    };
  }

  async logout(): Promise<void> {
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
      await this.login();
    }
  }

  async query(sql: string): Promise<SapQueryResult> {
    await this.ensureSession();
    return this.request<SapQueryResult>("POST", "/SQLQueries", {
      SqlCode: "CAPYRA_QUERY",
      SqlText: sql,
    }).catch(async () => {
      // fallback via $crossjoin/custom query endpoint
      return this.request<SapQueryResult>(
        "GET",
        `/SQLQueries('CAPYRA_QUERY')/List`,
      );
    });
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
}
