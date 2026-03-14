import ora from "ora";
import chalk from "chalk";
import { log } from "../utils/logger";
import { readEnv } from "../utils/env";
import { resolve } from "path";

export async function runSkillTest(
  skillName: string,
  dir: string,
): Promise<void> {
  const target = resolve(dir);
  const env = readEnv(target);

  if (skillName === "sap-b1") {
    await testSapB1(env);
    return;
  }

  log.error(`Unknown skill: ${skillName}`);
  process.exit(1);
}

async function testSapB1(env: Record<string, string>): Promise<void> {
  const spinner = ora("Testing SAP B1 connection...").start();

  const required = [
    "SAP_BASE_URL",
    "SAP_COMPANY_DB",
    "SAP_USERNAME",
    "SAP_PASSWORD",
  ];
  const missing = required.filter((k) => !env[k]);

  if (missing.length > 0) {
    spinner.fail(`Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  try {
    const { SapB1Client } = require("@capyra/skill-sap-b1");
    const client = new SapB1Client({
      baseUrl: env.SAP_BASE_URL,
      companyDB: env.SAP_COMPANY_DB,
      username: env.SAP_USERNAME,
      password: env.SAP_PASSWORD,
      verifySsl: env.SAP_VERIFY_SSL === "true",
    });

    await client.login();
    await client.logout();

    spinner.succeed(chalk.green("SAP B1 connection OK"));
  } catch (err) {
    spinner.fail(
      `SAP B1 connection failed: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}
