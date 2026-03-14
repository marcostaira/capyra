import ora from "ora";
import { existsSync } from "fs";
import { resolve } from "path";
import { log } from "../utils/logger";
import { dockerComposeUp, dockerComposeLogs } from "../utils/docker";

export async function runStart(
  dir: string,
  opts: { logs: boolean },
): Promise<void> {
  const target = resolve(dir);

  if (!existsSync(`${target}/docker-compose.yml`)) {
    log.error("No docker-compose.yml found. Run `capyra init` first.");
    process.exit(1);
  }

  const spinner = ora("Starting Capyra services...").start();
  const ok = dockerComposeUp(target);

  if (!ok) {
    spinner.fail("Failed to start services.");
    process.exit(1);
  }

  spinner.succeed("Capyra is running 🦫");
  log.info("Gateway: ws://localhost:18789");
  log.info("Webhook: http://localhost:3001/webhook");
  log.info("Health:  http://localhost:3001/health");

  if (opts.logs) {
    console.log("\nStreaming logs (Ctrl+C to stop):\n");
    dockerComposeLogs(target);
  }
}
