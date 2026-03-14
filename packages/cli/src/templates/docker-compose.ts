export function generateDockerCompose(opts: {
  withWhatsApp: boolean;
  withSap: boolean;
}): string {
  const whatsappService = opts.withWhatsApp
    ? `
  whatsapp:
    build:
      context: .
      dockerfile: packages/channels/whatsapp/Dockerfile
    container_name: capyra_whatsapp
    depends_on:
      - gateway
    environment:
      EVOLUTION_INSTANCE: \${EVOLUTION_INSTANCE}
      EVOLUTION_API_KEY: \${EVOLUTION_API_KEY}
      EVOLUTION_BASE_URL: \${EVOLUTION_BASE_URL}
      GATEWAY_URL: ws://gateway:\${GATEWAY_PORT:-18789}
      GATEWAY_SECRET: \${GATEWAY_SECRET}
      WEBHOOK_PORT: 3001
    ports:
      - "3001:3001"
    restart: unless-stopped
`
    : "";

  return `services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: capyra_postgres
    environment:
      POSTGRES_USER: capyra
      POSTGRES_PASSWORD: capyra
      POSTGRES_DB: capyra
    ports:
      - "5432:5432"
    volumes:
      - capyra_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U capyra"]
      interval: 5s
      timeout: 5s
      retries: 5

  gateway:
    build:
      context: .
      dockerfile: packages/core/Dockerfile
    container_name: capyra_gateway
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://capyra:capyra@postgres:5432/capyra
      GATEWAY_PORT: \${GATEWAY_PORT:-18789}
      GATEWAY_SECRET: \${GATEWAY_SECRET}
      ANTHROPIC_API_KEY: \${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: \${OPENAI_API_KEY}
      SAP_BASE_URL: \${SAP_BASE_URL}
      SAP_COMPANY_DB: \${SAP_COMPANY_DB}
      SAP_USERNAME: \${SAP_USERNAME}
      SAP_PASSWORD: \${SAP_PASSWORD}
      SAP_VERIFY_SSL: \${SAP_VERIFY_SSL:-false}
    ports:
      - "\${GATEWAY_PORT:-18789}:\${GATEWAY_PORT:-18789}"
    volumes:
      - ./workspaces:/app/workspaces
    restart: unless-stopped
${whatsappService}
volumes:
  capyra_pgdata:
`;
}
