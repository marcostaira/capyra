import inquirer from "inquirer";
import ora from "ora";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { execSync, spawnSync } from "child_process";
import chalk from "chalk";
import { log } from "../utils/logger";
import { writeEnv, generateSecret, EnvValues } from "../utils/env";
import { isDockerAvailable, isDockerComposeAvailable } from "../utils/docker";
import { generateCapyraConfig } from "../templates/capyra-config";

const REPO_URL = "https://github.com/yourusername/capyra.git";

export async function runInit(targetDir: string): Promise<void> {
  log.capyra();

  const dir = resolve(targetDir);

  // ── verifica pré-requisitos ────────────────────
  const spinner = ora("Checking requirements...").start();

  if (!isDockerAvailable()) {
    spinner.fail(
      "Docker not found. Install Docker first: https://docs.docker.com/get-docker/",
    );
    process.exit(1);
  }

  if (!isDockerComposeAvailable()) {
    spinner.fail("Docker Compose not found.");
    process.exit(1);
  }

  if (!isGitAvailable()) {
    spinner.fail("Git not found. Install Git first: https://git-scm.com/");
    process.exit(1);
  }

  spinner.succeed("Requirements OK");

  // ── clone ou usa diretório existente ──────────
  const isExisting = existsSync(join(dir, "package.json"));

  if (!isExisting) {
    const cloneSpinner = ora(`Cloning Capyra into ${dir}...`).start();
    try {
      spawnSync("git", ["clone", REPO_URL, dir], { stdio: "pipe" });
      cloneSpinner.succeed("Repository cloned");
    } catch (err) {
      cloneSpinner.fail("Failed to clone repository");
      process.exit(1);
    }
  } else {
    log.info("Existing Capyra installation found — skipping clone");
  }

  if (existsSync(join(dir, ".env"))) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: ".env already exists. Overwrite?",
        default: false,
      },
    ]);
    if (!overwrite) {
      log.warn("Init cancelled.");
      process.exit(0);
    }
  }

  console.log(
    chalk.gray("\nAnswer a few questions to set up your Capyra instance.\n"),
  );

  // ── perguntas ─────────────────────────────────
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "workspace",
      message: "Workspace name:",
      default: "default",
      validate: (v: string) =>
        /^[a-z0-9-]+$/.test(v) || "Lowercase letters, numbers and hyphens only",
    },
    {
      type: "list",
      name: "llmProvider",
      message: "LLM provider:",
      choices: [
        { name: "Anthropic (Claude)", value: "anthropic" },
        { name: "OpenAI (GPT)", value: "openai" },
        { name: "Both (Anthropic primary, OpenAI fallback)", value: "both" },
      ],
    },
    {
      type: "password",
      name: "anthropicKey",
      message: "Anthropic API key:",
      when: (a: Record<string, string>) =>
        a.llmProvider === "anthropic" || a.llmProvider === "both",
      validate: (v: string) =>
        v.startsWith("sk-ant-") || "Invalid Anthropic key format",
    },
    {
      type: "password",
      name: "openaiKey",
      message: "OpenAI API key:",
      when: (a: Record<string, string>) =>
        a.llmProvider === "openai" || a.llmProvider === "both",
      validate: (v: string) =>
        v.startsWith("sk-") || "Invalid OpenAI key format",
    },
    {
      type: "confirm",
      name: "withWhatsApp",
      message: "Enable WhatsApp channel (via Evolution API)?",
      default: true,
    },
    {
      type: "input",
      name: "evolutionUrl",
      message: "Evolution API base URL:",
      when: (a: Record<string, string>) => a.withWhatsApp,
      default: "https://evolution.yourdomain.com",
      validate: (v: string) => v.startsWith("http") || "Must be a valid URL",
    },
    {
      type: "input",
      name: "evolutionInstance",
      message: "Evolution API instance name:",
      when: (a: Record<string, string>) => a.withWhatsApp,
    },
    {
      type: "password",
      name: "evolutionApiKey",
      message: "Evolution API key (instance key):",
      when: (a: Record<string, string>) => a.withWhatsApp,
    },
    {
      type: "confirm",
      name: "withSap",
      message: "Enable SAP Business One skill?",
      default: false,
    },
    {
      type: "input",
      name: "sapUrl",
      message: "SAP B1 Service Layer URL:",
      when: (a: Record<string, string>) => a.withSap,
      default: "https://your-sap-server:50000/b1s/v2",
    },
    {
      type: "input",
      name: "sapCompanyDb",
      message: "SAP B1 Company DB:",
      when: (a: Record<string, string>) => a.withSap,
    },
    {
      type: "input",
      name: "sapUsername",
      message: "SAP B1 username:",
      when: (a: Record<string, string>) => a.withSap,
      default: "manager",
    },
    {
      type: "password",
      name: "sapPassword",
      message: "SAP B1 password:",
      when: (a: Record<string, string>) => a.withSap,
    },
  ]);

  // ── instala dependências ───────────────────────
  const installSpinner = ora("Installing dependencies...").start();
  const installResult = spawnSync("npm", ["install"], {
    cwd: dir,
    stdio: "pipe",
  });
  if (installResult.status !== 0) {
    installSpinner.fail("npm install failed");
    console.error(installResult.stderr?.toString());
    process.exit(1);
  }
  installSpinner.succeed("Dependencies installed");

  // ── build ──────────────────────────────────────
  const buildSpinner = ora("Building packages...").start();
  const buildResult = spawnSync("npm", ["run", "build"], {
    cwd: dir,
    stdio: "pipe",
  });
  if (buildResult.status !== 0) {
    buildSpinner.fail("Build failed");
    console.error(buildResult.stderr?.toString());
    process.exit(1);
  }

  // copia migration
  mkdirSync(join(dir, "packages/core/dist/db/migrations"), { recursive: true });
  try {
    execSync(
      `cp ${dir}/packages/core/src/db/migrations/*.sql ${dir}/packages/core/dist/db/migrations/`,
    );
  } catch {}

  buildSpinner.succeed("Build complete");

  // ── gera arquivos de config ────────────────────
  const genSpinner = ora("Generating configuration...").start();

  const model =
    answers.llmProvider === "openai" ? "gpt-4o" : "claude-sonnet-4-6";

  const envValues: EnvValues = {
    DATABASE_URL: "postgresql://capyra:capyra@localhost:5432/capyra",
    GATEWAY_PORT: "18789",
    GATEWAY_SECRET: generateSecret(),
    ...(answers.anthropicKey && { ANTHROPIC_API_KEY: answers.anthropicKey }),
    ...(answers.openaiKey && { OPENAI_API_KEY: answers.openaiKey }),
    ...(answers.withWhatsApp && {
      EVOLUTION_INSTANCE: answers.evolutionInstance,
      EVOLUTION_API_KEY: answers.evolutionApiKey,
      EVOLUTION_BASE_URL: answers.evolutionUrl,
    }),
    ...(answers.withSap && {
      SAP_BASE_URL: answers.sapUrl,
      SAP_COMPANY_DB: answers.sapCompanyDb,
      SAP_USERNAME: answers.sapUsername,
      SAP_PASSWORD: answers.sapPassword,
      SAP_VERIFY_SSL: "false",
    }),
  };

  writeEnv(dir, envValues);

  writeFileSync(
    join(dir, "capyra.config.yml"),
    generateCapyraConfig({
      workspace: answers.workspace,
      llmProvider: answers.llmProvider === "openai" ? "openai" : "anthropic",
      model,
      withSap: Boolean(answers.withSap),
      withWhatsApp: Boolean(answers.withWhatsApp),
    }),
    "utf-8",
  );

  mkdirSync(join(dir, "workspaces", answers.workspace), { recursive: true });
  writeFileSync(
    join(dir, "workspaces", answers.workspace, "HEARTBEAT.md"),
    `# Heartbeat Checklist\n\n- [ ] Check for pending approvals\n- [ ] Monitor critical stock levels\n`,
    "utf-8",
  );

  genSpinner.succeed("Configuration generated");

  // ── resumo ────────────────────────────────────
  console.log(`
${chalk.bold.green("✔ Capyra initialized successfully!")}

${chalk.bold("Next steps:")}

  ${chalk.yellow("1.")} Start Capyra:
     ${chalk.cyan(`cd ${dir} && npm start`)}

  ${
    answers.withWhatsApp
      ? `${chalk.yellow("2.")} Register your webhook in Evolution API:
     ${chalk.cyan(`curl -X POST ${answers.evolutionUrl}/webhook/set/${answers.evolutionInstance} \\
       -H "apikey: ${answers.evolutionApiKey}" \\
       -H "Content-Type: application/json" \\
       -d '{"url":"http://YOUR_SERVER_IP:3001/webhook","events":["messages.upsert"]}'`)}`
      : ""
  }

${chalk.bold("Docs:")} ${chalk.underline("https://capyra.dev/docs")}
`);
}

function isGitAvailable(): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
