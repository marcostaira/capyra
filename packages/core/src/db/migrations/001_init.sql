-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  workspace   TEXT NOT NULL DEFAULT 'default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_channel ON sessions(channel, channel_id);

-- ─────────────────────────────────────────
-- EVENT STORE (imutável — nunca deletar)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES sessions(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type        TEXT NOT NULL,
  -- tipos: message_in | message_out | tool_call | tool_result
  --        decision | error | heartbeat | approval_required | approved | rejected

  -- payload completo do evento
  payload     JSONB NOT NULL DEFAULT '{}',

  -- para tool calls
  tool_name   TEXT,
  tool_input  JSONB,
  tool_output JSONB,

  -- auditoria
  approved_by TEXT,       -- NULL = autônomo, user_id = aprovado por humano
  duration_ms INTEGER,    -- tempo de execução da tool
  llm_tokens  INTEGER     -- tokens consumidos (se aplicável)
);

CREATE INDEX idx_events_session ON agent_events(session_id, occurred_at);
CREATE INDEX idx_events_type ON agent_events(type);
CREATE INDEX idx_events_tool ON agent_events(tool_name) WHERE tool_name IS NOT NULL;

-- ─────────────────────────────────────────
-- MEMÓRIA EPISÓDICA
-- últimas N mensagens por sessão
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_episodic (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES sessions(id),
  role        TEXT NOT NULL,  -- user | assistant | tool
  content     TEXT NOT NULL,
  event_id    UUID REFERENCES agent_events(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episodic_session ON memory_episodic(session_id, created_at);

-- ─────────────────────────────────────────
-- MEMÓRIA SEMÂNTICA
-- fatos sobre o negócio indexados por vetor
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_semantic (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace   TEXT NOT NULL DEFAULT 'default',
  content     TEXT NOT NULL,        -- o fato em linguagem natural
  source      TEXT,                 -- de onde veio (tool_call, user, etc)
  embedding   vector(1536),         -- OpenAI text-embedding-3-small
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ           -- NULL = permanente
);

CREATE INDEX idx_semantic_workspace ON memory_semantic(workspace);
CREATE INDEX idx_semantic_embedding ON memory_semantic
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─────────────────────────────────────────
-- MEMÓRIA PROCEDURAL
-- como esse workspace prefere que as coisas sejam feitas
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_procedural (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace   TEXT NOT NULL DEFAULT 'default',
  key         TEXT NOT NULL,        -- ex: "preferred_supplier_A-4521"
  value       TEXT NOT NULL,        -- ex: "Distribuidora X, sempre 50 unidades"
  confidence  FLOAT DEFAULT 1.0,    -- 0.0 a 1.0, cai se contradito
  source      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace, key)
);

CREATE INDEX idx_procedural_workspace ON memory_procedural(workspace);

-- ─────────────────────────────────────────
-- TOOL APPROVALS
-- controle de quais tools precisam de aprovação
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_policies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace   TEXT NOT NULL DEFAULT 'default',
  tool_name   TEXT NOT NULL,
  policy      TEXT NOT NULL DEFAULT 'auto',
  -- auto = executa sem perguntar
  -- confirm = pede confirmação antes
  -- deny = nunca executa
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace, tool_name)
);

-- defaults seguros para tools de escrita
INSERT INTO tool_policies (workspace, tool_name, policy) VALUES
  ('default', 'sap_create_order_draft', 'confirm'),
  ('default', 'sap_create_purchase_draft', 'confirm'),
  ('default', 'filesystem_write', 'confirm'),
  ('default', 'filesystem_delete', 'deny')
ON CONFLICT DO NOTHING;