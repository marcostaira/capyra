<div align="center">

<img src="docs/assets/capyra-banner.png" alt="Capyra" width="600" />

# Capyra

**The open-source agent runtime that connects AI to any business system.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![Discord](https://img.shields.io/discord/XXXXXXX?label=Discord&logo=discord)](https://discord.gg/capyra)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/capyra?style=social)](https://github.com/yourusername/capyra)

[**Quick Start**](#quick-start) · [**Documentation**](https://capyra.dev/docs) · [**Discord**](https://discord.gg/capyra) · [**Skills**](#skills)

</div>

---

## What is Capyra?

Capyra is an **autonomous agent runtime** you self-host on your own infrastructure.

You connect it to your business systems — ERP, databases, APIs — and your team interacts with it through the messaging apps they already use: **WhatsApp, Telegram, Slack, Discord**.

The agent doesn't just answer questions. It **acts**.

```
Your team member sends a WhatsApp message:
"How many orders are pending approval today?"

Capyra queries SAP Business One and replies in seconds:
"7 orders pending approval, total $48,320.
Oldest: order #4821 from Acme Corp, waiting 3 days.
Want me to send a reminder to the approvers?"
```

No dashboards to open. No reports to run. No IT ticket to file.

---

## Demo

> **Demo 1 — Instant business query**

![Demo 1](docs/assets/demo-query.gif)

> **Demo 2 — Proactive stock alert (no one asked)**

![Demo 2](docs/assets/demo-heartbeat.gif)

> **Demo 3 — Action with confirmation**

![Demo 3](docs/assets/demo-action.gif)

---

## Why Capyra?

|                       | Capyra | Generic AI chatbots | RPA / Workflow tools |
| --------------------- | ------ | ------------------- | -------------------- |
| Acts autonomously     | ✅     | ❌                  | ⚠️ rigid rules only  |
| WhatsApp native       | ✅     | ❌                  | ❌                   |
| Self-hosted           | ✅     | ❌                  | ⚠️ mostly cloud      |
| Open-source           | ✅ MIT | ❌                  | ❌                   |
| Connects to ERP/SAP   | ✅     | ❌                  | ⚠️ complex setup     |
| Full audit trail      | ✅     | ❌                  | ⚠️                   |
| Extensible via Skills | ✅     | ❌                  | ⚠️                   |
| Your data stays local | ✅     | ❌                  | ⚠️                   |

---

## Quick Start

You need **Docker** and **Node.js ≥ 22**.

```bash
# Install the CLI
npm install -g @capyra/cli

# Initialize a new instance
capyra init my-company

# Follow the wizard — takes about 2 minutes
cd my-company
capyra start
```

That's it. Capyra is running.

**What the wizard sets up:**

- PostgreSQL with pgvector (memory + embeddings)
- Gateway WebSocket server
- WhatsApp channel via Evolution API _(optional)_
- SAP Business One connector _(optional)_
- All secrets auto-generated

---

## How it works

```
WhatsApp / Telegram / Slack / Discord
              │
              ▼
     ┌─────────────────┐
     │  Capyra Gateway │  ← always-on WebSocket server
     └────────┬────────┘
              │
     ┌────────▼────────┐
     │   Agent Loop    │  ← perceive → plan → act
     └────────┬────────┘
              │
     ┌────────▼────────┐
     │     Skills      │  ← SAP B1 · HTTP · Postgres · ...
     └────────┬────────┘
              │
     ┌────────▼────────┐
     │  LLM Provider   │  ← Claude · GPT · Ollama
     └─────────────────┘

Memory: episodic + semantic (pgvector) + procedural
Events: immutable audit log — every action recorded
```

### Skills

Skills are directories containing a `SKILL.md` file with instructions for the LLM and an implementation file with tool definitions.

```
my-skill/
├── SKILL.md      ← what the LLM reads
├── index.ts      ← tool implementations
└── README.md     ← docs for developers
```

Any developer can build and share a skill. Skills can be:

- **Bundled** — included with Capyra core
- **Installed** — from the community registry
- **Local** — in your workspace for private integrations

---

## Official Skills

| Skill             | Description                           | Status    |
| ----------------- | ------------------------------------- | --------- |
| `sap-b1`          | SAP Business One via Service Layer    | ✅ stable |
| `http`            | Generic HTTP requests                 | ✅ stable |
| `postgres`        | Run queries against any PostgreSQL DB | 🚧 soon   |
| `cron`            | Scheduled tasks and heartbeats        | 🚧 soon   |
| `filesystem`      | Read local files and documents        | 🚧 soon   |
| `gmail`           | Read and send email                   | 🚧 soon   |
| `google-calendar` | Read and create calendar events       | 🚧 soon   |

**Community skills:** [capyra.dev/skills](https://capyra.dev/skills)

---

## SAP Business One

Capyra has first-class SAP B1 support via Service Layer REST API.
Works with SAP B1 9.3+ on both HANA and SQL Server.

```yaml
# capyra.config.yml
skills:
  sap-b1:
    enabled: true
```

```env
# .env
SAP_BASE_URL=https://your-sap-server:50000/b1s/v1
SAP_COMPANY_DB=YOUR_DB
SAP_USERNAME=manager
SAP_PASSWORD=your-password
```

**What your team can ask:**

```
"List all open orders from last week"
"Check stock for item A-4521"
"How much does customer Acme Corp owe us?"
"Create a purchase order draft for 50 units of A-4521"
"Which items are below minimum stock right now?"
```

**Test your connection:**

```bash
capyra skill test sap-b1
```

---

## WhatsApp

Capyra uses [Evolution API](https://github.com/EvolutionAPI/evolution-api) for WhatsApp integration.

```bash
# After capyra start, register your webhook:
curl -X POST https://your-evolution-api/webhook/set/your-instance \
  -H "apikey: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://your-server:3001/webhook",
    "events": ["messages.upsert"]
  }'
```

For actions that modify data, Capyra always asks for confirmation:

```
Capyra: ⚠️ Action required
        The agent wants to execute: sap_create_order_draft

        Parameters:
        {
          "cardCode": "C0001",
          "items": [{ "itemCode": "A-4521", "quantity": 50 }]
        }

        Reply yes to confirm or no to cancel.

You: yes

Capyra: ✔ Draft created — Order #4891.
```

---

## Memory

Capyra has a three-layer memory system that persists across sessions:

**Episodic** — recent conversation history per user session

**Semantic** — facts about the business stored as vector embeddings, searched by relevance

**Procedural** — learned preferences and patterns specific to your workspace:

```
preferred_supplier_A4521 → Distribuidora X, always 50 units
approval_threshold → orders above $10,000 need manager approval
```

---

## Audit Trail

Every agent action is recorded as an immutable event:

```sql
SELECT occurred_at, type, tool_name, tool_input, approved_by
FROM agent_events
WHERE session_id = '...'
ORDER BY occurred_at;

-- occurred_at          type              tool_name              approved_by
-- 2025-03-14 10:00:01  message_in        null                   null
-- 2025-03-14 10:00:02  decision          null                   null
-- 2025-03-14 10:00:02  tool_call         sap_get_orders         null
-- 2025-03-14 10:00:03  tool_result       sap_get_orders         null
-- 2025-03-14 10:00:03  approval_required sap_create_order_draft null
-- 2025-03-14 10:00:41  approved          sap_create_order_draft user
-- 2025-03-14 10:00:42  tool_call         sap_create_order_draft user
-- 2025-03-14 10:00:43  message_out       null                   null
```

---

## Tool Policies

Control exactly what the agent can do without asking:

```sql
-- auto = executes without asking
-- confirm = asks user before executing
-- deny = never executes

INSERT INTO tool_policies (workspace, tool_name, policy) VALUES
  ('acme-corp', 'sap_get_orders',        'auto'),
  ('acme-corp', 'sap_get_stock',         'auto'),
  ('acme-corp', 'sap_create_order_draft','confirm'),
  ('acme-corp', 'filesystem_delete',     'deny');
```

---

## CLI Reference

```bash
capyra init [dir]              # Initialize a new instance
capyra start [dir]             # Start all services
capyra start [dir] --logs      # Start and stream logs
capyra status [dir]            # Show service status
capyra skill test <name>       # Test a skill connection
```

---

## Configuration

```yaml
# capyra.config.yml

workspace: acme-corp

llm:
  provider: anthropic # anthropic | openai
  model: claude-sonnet-4-6
  max_tokens: 4096

gateway:
  port: 18789
  heartbeat_interval: 1800 # seconds between proactive checks

skills:
  sap-b1:
    enabled: true

channels:
  - name: whatsapp
    enabled: true

memory:
  episodic_window: 20 # last N messages in context
  semantic_search_limit: 5 # facts retrieved per query
```

---

## Building a Skill

Create a directory with two files:

**`SKILL.md`** — instructions for the LLM:

```markdown
# My Custom Skill

## Purpose

Brief description of what this skill does.

## Available Tools

### my_tool

Description of what this tool does and when to use it.

## Behavior Rules

- Always confirm before modifying data
- Format currency values with $ and 2 decimal places
```

**`index.ts`** — tool implementation:

```typescript
import { SkillExecutor, ToolDefinition } from "@capyra/core";

const tools: ToolDefinition[] = [
  {
    name: "my_tool",
    description: "Does something useful",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The input" },
      },
      required: ["query"],
    },
  },
];

export class MySkill implements SkillExecutor {
  tools = tools;

  async execute(toolName: string, params: Record<string, unknown>) {
    if (toolName === "my_tool") {
      // your implementation
      return { result: `Processed: ${params.query}` };
    }
    throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

[Full skill development guide →](https://capyra.dev/docs/skills)

---

## Stack

- **Runtime** — Node.js 22
- **Gateway** — WebSocket (ws)
- **Database** — PostgreSQL 16 + pgvector
- **LLM** — Anthropic Claude / OpenAI GPT / Ollama (local)
- **WhatsApp** — Evolution API v2
- **Infrastructure** — Docker Compose
- **Language** — TypeScript

---

## Roadmap

- [x] Gateway WebSocket server
- [x] Agent loop (Anthropic + OpenAI)
- [x] Three-layer memory system
- [x] Immutable event store / audit trail
- [x] SAP Business One skill
- [x] WhatsApp channel
- [x] CLI (`capyra init`, `capyra start`)
- [ ] Telegram channel
- [ ] Slack channel
- [ ] Skills registry (capyra.dev/skills)
- [ ] Dashboard (Next.js)
- [ ] Agent-to-Agent (A2A) protocol
- [ ] Computer Use skill
- [ ] Totvs / Omie connectors
- [ ] `capyra skill install <name>`

---

## Contributing

Capyra is MIT licensed and community-driven.

The best way to contribute is to **build a skill** for a system you know well and share it with the community.

```bash
git clone https://github.com/yourusername/capyra
cd capyra
npm install
npm run dev
```

[Contributing guide →](CONTRIBUTING.md) · [Discord →](https://discord.gg/capyra)

---

## Self-hosting

Capyra is designed to run on your infrastructure.
Your data never leaves your servers.

**Minimum requirements:**

- 1 vCPU, 1GB RAM (development)
- 2 vCPU, 2GB RAM (production)
- Docker + Docker Compose

Works on any Linux server, VPS, homelab, or cloud provider.

---

## Security

- All credentials stored locally in `.env` — never sent to Capyra servers
- Tool policies control write access per workspace
- Approval flows required for data modification by default
- Full audit trail of every agent action
- Service Layer SSL support (configurable for internal networks)

**Found a vulnerability?** Please report privately: security@capyra.dev

---

## License

MIT © [Marcos](https://github.com/yourusername)

---

<div align="center">

Built in Brazil 🇧🇷 · Powered by the 🦫 capybara spirit

**[capyra.dev](https://capyra.dev)**

</div>
