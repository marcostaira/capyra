import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface EnvValues {
  // Database
  DATABASE_URL: string;

  // Gateway
  GATEWAY_PORT: string;
  GATEWAY_SECRET: string;

  // LLM
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;

  // WhatsApp
  EVOLUTION_INSTANCE?: string;
  EVOLUTION_API_KEY?: string;
  EVOLUTION_BASE_URL?: string;

  // SAP B1
  SAP_BASE_URL?: string;
  SAP_COMPANY_DB?: string;
  SAP_USERNAME?: string;
  SAP_PASSWORD?: string;
  SAP_VERIFY_SSL?: string;
}

export function writeEnv(dir: string, values: EnvValues): void {
  const lines = Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`);

  writeFileSync(join(dir, ".env"), lines.join("\n") + "\n", "utf-8");
}

export function readEnv(dir: string): Record<string, string> {
  const envPath = join(dir, ".env");
  if (!existsSync(envPath)) return {};

  return readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .reduce(
      (acc, line) => {
        const [key, ...rest] = line.split("=");
        if (key) acc[key.trim()] = rest.join("=").trim();
        return acc;
      },
      {} as Record<string, string>,
    );
}

export function generateSecret(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}
