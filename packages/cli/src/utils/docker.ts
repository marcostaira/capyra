import { execSync, spawnSync } from "child_process";
import { log } from "./logger";

export function isDockerAvailable(): boolean {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isDockerComposeAvailable(): boolean {
  try {
    execSync("docker compose version", { stdio: "ignore" });
    return true;
  } catch {
    try {
      execSync("docker-compose --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

export function dockerComposeUp(dir: string): boolean {
  const result = spawnSync("docker", ["compose", "up", "-d", "--build"], {
    cwd: dir,
    stdio: "inherit",
  });
  return result.status === 0;
}

export function dockerComposeDown(dir: string): boolean {
  const result = spawnSync("docker", ["compose", "down"], {
    cwd: dir,
    stdio: "inherit",
  });
  return result.status === 0;
}

export function dockerComposeLogs(dir: string, service?: string): void {
  const args = ["compose", "logs", "-f"];
  if (service) args.push(service);
  spawnSync("docker", args, { cwd: dir, stdio: "inherit" });
}

export function getContainerStatus(
  dir: string,
): Array<{ name: string; status: string }> {
  try {
    const result = execSync("docker compose ps --format json", {
      cwd: dir,
      encoding: "utf-8",
    });
    return result
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((c: Record<string, string>) => ({
        name: c.Service ?? c.Name,
        status: c.State ?? c.Status,
      }));
  } catch {
    return [];
  }
}
