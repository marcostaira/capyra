# @capyra/cli

The Capyra CLI — initialize and manage your Capyra agent runtime.

## Install

```bash
npm install -g @capyra/cli
```

## Usage

```bash
# Initialize a new Capyra instance
capyra init my-company

# Check status
capyra status

# Test a skill connection
capyra skill test sap-b1
```

## What capyra init does

- Creates project directory
- Runs interactive wizard (LLM provider, WhatsApp, SAP B1)
- Generates `.env`, `docker-compose.yml`, `capyra.config.yml`
- Installs dependencies
- Starts PostgreSQL via Docker

## Links

- [GitHub](https://github.com/marcostaira/capyra)
- [Documentation](https://capyra.dev/docs)
- [Discord](https://discord.gg/4XA7g43Ppu)
