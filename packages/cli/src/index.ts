#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init";
import { runStart } from "./commands/start";
import { runStatus } from "./commands/status";
import { runSkillTest } from "./commands/skill";

const program = new Command();

program
  .name("capyra")
  .description("The open-source agent runtime 🦫")
  .version("0.1.0");

program
  .command("init [dir]")
  .description("Initialize a new Capyra instance")
  .action((dir = ".") => runInit(dir));

program
  .command("start [dir]")
  .description("Start Capyra services via Docker Compose")
  .option("-l, --logs", "Stream logs after starting")
  .action((dir = ".", opts) => runStart(dir, opts));

program
  .command("status [dir]")
  .description("Show status of running services")
  .action((dir = ".") => runStatus(dir));

program
  .command("skill")
  .description("Manage and test skills")
  .addCommand(
    new Command("test")
      .argument("<skill>", "Skill name (e.g. sap-b1)")
      .option("-d, --dir <dir>", "Project directory", ".")
      .description("Test a skill connection")
      .action((skill, opts) => runSkillTest(skill, opts.dir)),
  );

program.parse();
