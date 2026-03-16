# @capyra/core

The Capyra Gateway and agent loop — the core runtime.

## What it does

- WebSocket Gateway (always-on control plane)
- Agent loop: perceive → plan → act
- Three-layer memory: episodic + semantic (pgvector) + procedural
- Immutable event store (audit trail)
- Tool policy engine (auto / confirm / deny)

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
docker pull marcostaira/capyra-gateway
```

## Links

- [GitHub](https://github.com/marcostaira/capyra)
- [Documentation](https://capyra.dev/docs)
- [Discord](https://discord.gg/4XA7g43Ppu)
