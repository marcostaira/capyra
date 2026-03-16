# @capyra/channel-whatsapp

WhatsApp channel adapter for Capyra via Evolution API v2.

## What it does

- Receives messages via Evolution API webhook
- Handles WhatsApp LID addressing mode (2025)
- Sends responses back via Evolution API
- Manages approval flows (yes/no confirmation)
- Reconnects automatically on disconnect

## Requirements

- [Evolution API](https://github.com/EvolutionAPI/evolution-api) v2
- A connected WhatsApp instance

## Usage

Not meant to be used directly. Use the CLI:

```bash
npm install -g @capyra/cli
capyra init my-company
cd my-company
npm start
```

## Docker

```bash
docker pull marcostaira/capyra-whatsapp
```

## Webhook setup

```bash
curl -X POST https://your-evolution-api/webhook/set/your-instance \
  -H "apikey: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://your-server:3001/webhook",
      "byEvents": true,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

## Links

- [GitHub](https://github.com/marcostaira/capyra)
- [Documentation](https://capyra.dev/docs)
- [Discord](https://discord.gg/4XA7g43Ppu)
