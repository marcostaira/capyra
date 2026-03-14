export function generateEnvExample(opts: {
  withWhatsApp: boolean;
  withSap: boolean;
}): string {
  const whatsappBlock = opts.withWhatsApp
    ? `
# WhatsApp — Evolution API v2
EVOLUTION_INSTANCE=your-instance-name
EVOLUTION_API_KEY=your-instance-api-key
EVOLUTION_BASE_URL=https://evolution.yourdomain.com
`
    : "";

  const sapBlock = opts.withSap
    ? `
# SAP Business One — Service Layer
SAP_BASE_URL=https://your-sap-server:50000/b1s/v1
SAP_COMPANY_DB=YOUR_COMPANY_DB
SAP_USERNAME=manager
SAP_PASSWORD=your-password
SAP_VERIFY_SSL=false
`
    : "";

  return `# Capyra Environment Variables
# Copy this file to .env and fill in your values
# Never commit .env to git

# Database (auto-configured via Docker)
DATABASE_URL=postgresql://capyra:capyra@localhost:5432/capyra

# Gateway
GATEWAY_PORT=18789
GATEWAY_SECRET=change-this-to-a-random-string

# LLM Provider (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
${whatsappBlock}${sapBlock}`;
}
