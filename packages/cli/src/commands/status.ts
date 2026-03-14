import chalk from "chalk";
import { resolve } from "path";
import { existsSync } from "fs";
import { log } from "../utils/logger";
import { getContainerStatus } from "../utils/docker";
import { readEnv } from "../utils/env";

export async function runStatus(dir: string): Promise<void> {
  const target = resolve(dir);

  if (!existsSync(`${target}/docker-compose.yml`)) {
    log.error("No Capyra installation found here. Run `capyra init` first.");
    process.exit(1);
  }

  const containers = getContainerStatus(target);
  const env = readEnv(target);

  console.log(chalk.bold("\n🦫 Capyra Status\n"));

  if (containers.length === 0) {
    log.warn("No containers running. Start with `capyra start`.");
    return;
  }

  for (const c of containers) {
    const icon = c.status === "running" ? chalk.green("●") : chalk.red("●");
    console.log(`  ${icon}  ${chalk.bold(c.name.padEnd(20))} ${c.status}`);
  }

  console.log();

  if (env.SAP_BASE_URL) {
    log.info(`SAP B1: ${env.SAP_BASE_URL}`);
  }
  if (env.EVOLUTION_INSTANCE) {
    log.info(`WhatsApp instance: ${env.EVOLUTION_INSTANCE}`);
  }
  if (env.ANTHROPIC_API_KEY) {
    log.info("LLM: Anthropic Claude");
  } else if (env.OPENAI_API_KEY) {
    log.info("LLM: OpenAI GPT");
  }

  console.log();
}
