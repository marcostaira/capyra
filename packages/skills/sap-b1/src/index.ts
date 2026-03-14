import { SapB1Client } from "./client.js";
import { tools } from "./tools.js";
import { SapB1Config } from "./types.js";

export class SapB1Skill {
  private client: SapB1Client;
  public readonly tools = tools;

  constructor(config: SapB1Config) {
    this.client = new SapB1Client(config);
  }

  async execute(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const tool = this.tools.find((t) => t.name === toolName);
    if (!tool) throw new Error(`Tool ${toolName} not found in sap-b1 skill`);
    return tool.execute(params, this.client);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.login();
      await this.client.logout();
      return true;
    } catch {
      return false;
    }
  }
}

export { tools } from "./tools.js";
export * from "./types.js";
