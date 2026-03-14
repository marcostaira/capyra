# Contributing to Capyra

Thanks for your interest in contributing! 🦫

## The best way to contribute

**Build a skill.** If you know a business system well — an ERP, a CRM, a local API —
wrap it as a Capyra skill and share it with the community.

## Getting started

```bash
git clone https://github.com/yourusername/capyra
cd capyra
npm install
cp .env.example .env
# fill in your .env
docker compose up postgres -d
npm run dev
```

## Building a skill

A skill is a directory with two required files:

```
packages/skills/your-skill/
├── SKILL.md       ← instructions for the LLM
├── index.ts       ← tool implementations
└── README.md      ← docs for developers
```

See `packages/skills/sap-b1` as a reference implementation.

**Rules for skills:**

- Read-only tools can execute automatically (`policy: auto`)
- Write tools must require confirmation (`policy: confirm`)
- Never log or expose credentials in tool output
- Always validate input before calling external APIs

## Project structure

| Package               | Description                              |
| --------------------- | ---------------------------------------- |
| `packages/core`       | Gateway, agent loop, memory, event store |
| `packages/skills/*`   | Official skill connectors                |
| `packages/channels/*` | Channel adapters (WhatsApp, Telegram...) |
| `packages/cli`        | The `capyra` CLI                         |

## Pull request checklist

- [ ] Code builds without errors (`npm run build`)
- [ ] New skills include a `SKILL.md` and `README.md`
- [ ] Write operations require user confirmation
- [ ] No credentials or secrets in code or logs

## Community

- Discord: https://discord.gg/capyra
- Issues: GitHub Issues
- Docs: https://capyra.dev/docs
