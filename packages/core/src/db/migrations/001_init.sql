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

CREATE INDEX IF NOT EXISTS idx_sessions_channel ON sessions(channel, channel_id);

-- ─────────────────────────────────────────
-- EVENT STORE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES sessions(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  tool_name   TEXT,
  tool_input  JSONB,
  tool_output JSONB,
  approved_by TEXT,
  duration_ms INTEGER,
  llm_tokens  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_events_session ON agent_events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON agent_events(type);
CREATE INDEX IF NOT EXISTS idx_events_tool ON agent_events(tool_name) WHERE tool_name IS NOT NULL;

-- ─────────────────────────────────────────
-- MEMÓRIA EPISÓDICA
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_episodic (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES sessions(id),
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  event_id    UUID REFERENCES agent_events(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_episodic_session ON memory_episodic(session_id, created_at);

-- ─────────────────────────────────────────
-- MEMÓRIA SEMÂNTICA
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_semantic (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace   TEXT NOT NULL DEFAULT 'default',
  content     TEXT NOT NULL,
  source      TEXT,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_semantic_workspace ON memory_semantic(workspace);
CREATE INDEX IF NOT EXISTS idx_semantic_embedding ON memory_semantic
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─────────────────────────────────────────
-- MEMÓRIA PROCEDURAL
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_procedural (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace   TEXT NOT NULL DEFAULT 'default',
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  confidence  FLOAT DEFAULT 1.0,
  source      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace, key)
);

CREATE INDEX IF NOT EXISTS idx_procedural_workspace ON memory_procedural(workspace);

-- ─────────────────────────────────────────
-- TOOL POLICIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_policies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace   TEXT NOT NULL DEFAULT 'default',
  tool_name   TEXT NOT NULL,
  policy      TEXT NOT NULL DEFAULT 'auto',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace, tool_name)
);

INSERT INTO tool_policies (workspace, tool_name, policy) VALUES
  ('default', 'sap_create_order_draft',    'confirm'),
  ('default', 'sap_create_purchase_draft', 'confirm'),
  ('default', 'filesystem_write',          'confirm'),
  ('default', 'filesystem_delete',         'deny'),
  ('default', 'sap_create_business_partner', 'confirm')
ON CONFLICT DO NOTHING;