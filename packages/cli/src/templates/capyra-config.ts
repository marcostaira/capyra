export function generateCapyraConfig(opts: {
  workspace: string;
  llmProvider: "anthropic" | "openai";
  model: string;
  withSap: boolean;
  withWhatsApp: boolean;
}): string {
  const sapBlock = opts.withSap
    ? `
    sap-b1:
      enabled: true
`
    : "";

  const waBlock = opts.withWhatsApp
    ? `
  - name: whatsapp
    enabled: true
`
    : "";

  return `# Capyra Configuration
# https://capyra.dev/docs/configuration

workspace: ${opts.workspace}

llm:
  provider: ${opts.llmProvider}
  model: ${opts.model}
  max_tokens: 4096

gateway:
  port: 18789
  heartbeat_interval: 1800  # seconds

skills:${sapBlock || "\n  # add skills here"}

channels:${waBlock || "\n  # add channels here"}

memory:
  episodic_window: 20      # last N messages
  semantic_search_limit: 5
  procedural_confidence_threshold: 0.5
`;
}
