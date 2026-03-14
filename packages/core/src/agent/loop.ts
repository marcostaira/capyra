import { appendEvent } from "../events/store";
import { appendMessage, getRecentMessages } from "../memory/episodic";
import { searchFacts } from "../memory/semantic";
import { recallAll } from "../memory/procedural";
import { query } from "../db/index";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface SkillExecutor {
  tools: ToolDefinition[];
  execute(toolName: string, params: Record<string, unknown>): Promise<unknown>;
}

export interface AgentContext {
  sessionId: string;
  workspace: string;
  skills: SkillExecutor[];
  llmProvider: "anthropic" | "openai";
  model?: string;
  onMessage: (content: string) => Promise<void>;
  onApprovalRequired?: (
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<boolean>;
}

interface LLMMessage {
  role: "user" | "assistant";
  content: string | LLMContentBlock[];
}

interface LLMContentBlock {
  type: "text" | "tool_use" | "tool_result";
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  text?: string;
}

async function getToolPolicy(
  workspace: string,
  toolName: string,
): Promise<"auto" | "confirm" | "deny"> {
  const rows = await query<{ policy: string }>(
    `
    SELECT policy FROM tool_policies
    WHERE workspace = $1 AND tool_name = $2
  `,
    [workspace, toolName],
  );

  return (rows[0]?.policy as "auto" | "confirm" | "deny") ?? "auto";
}

async function buildSystemPrompt(ctx: AgentContext): Promise<string> {
  const procedural = await recallAll(ctx.workspace);

  const proceduralSection =
    procedural.length > 0
      ? `\n## What I know about how this workspace operates\n` +
        procedural.map((p) => `- ${p.key}: ${p.value}`).join("\n")
      : "";

  return `You are Capyra, an autonomous business agent.
You have access to tools that connect to real business systems.
Always be concise and direct in your responses.
For write operations, always confirm with the user before executing.
Format monetary values with currency symbol and 2 decimal places.
Format dates as DD/MM/YYYY in responses.
Flag items below minimum stock with ⚠️.
${proceduralSection}`;
}

export async function runAgentLoop(
  ctx: AgentContext,
  userMessage: string,
): Promise<void> {
  // 1. salva mensagem do usuário
  const eventIn = await appendEvent({
    sessionId: ctx.sessionId,
    type: "message_in",
    payload: { content: userMessage, channel: ctx.workspace },
  });

  await appendMessage(ctx.sessionId, "user", userMessage, eventIn.id);

  // 2. busca contexto relevante na memória semântica
  const relevantFacts = await searchFacts(ctx.workspace, userMessage, 3);

  // 3. monta histórico de mensagens
  const history = await getRecentMessages(ctx.sessionId, 20);

  // 4. coleta todas as tools disponíveis
  const allTools = ctx.skills.flatMap((s) => s.tools);

  // 5. monta mensagens para o LLM
  const messages: LLMMessage[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.role === "tool" ? `[Tool result]: ${m.content}` : m.content,
  }));

  // injeta fatos relevantes se houver
  if (relevantFacts.length > 0) {
    const factsText = relevantFacts.map((f) => `- ${f.content}`).join("\n");

    messages[messages.length - 1] = {
      ...messages[messages.length - 1],
      content: `${userMessage}\n\n[Relevant context from memory]\n${factsText}`,
    };
  }

  const systemPrompt = await buildSystemPrompt(ctx);

  // 6. loop de raciocínio
  let continueLoop = true;
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (continueLoop && iterations < MAX_ITERATIONS) {
    iterations++;

    const start = Date.now();
    const response = await callLLM({
      provider: ctx.llmProvider,
      model: ctx.model,
      system: systemPrompt,
      messages,
      tools: allTools,
    });

    const durationMs = Date.now() - start;

    await appendEvent({
      sessionId: ctx.sessionId,
      type: "decision",
      payload: { iteration: iterations, stopReason: response.stopReason },
      llmTokens: response.tokensUsed,
      durationMs,
    });

    // sem tool calls — resposta final
    if (!response.toolCalls || response.toolCalls.length === 0) {
      const text = response.text ?? "";

      const eventOut = await appendEvent({
        sessionId: ctx.sessionId,
        type: "message_out",
        payload: { content: text },
      });

      await appendMessage(ctx.sessionId, "assistant", text, eventOut.id);
      await ctx.onMessage(text);
      continueLoop = false;
      break;
    }

    // executa tool calls
    const toolResults: string[] = [];

    for (const toolCall of response.toolCalls) {
      const policy = await getToolPolicy(ctx.workspace, toolCall.name);

      // tool bloqueada
      if (policy === "deny") {
        await appendEvent({
          sessionId: ctx.sessionId,
          type: "rejected",
          toolName: toolCall.name,
          toolInput: toolCall.input,
          payload: { reason: "policy_deny" },
        });
        toolResults.push(
          `Tool ${toolCall.name} is not allowed in this workspace.`,
        );
        continue;
      }

      // tool requer aprovação
      if (policy === "confirm" && ctx.onApprovalRequired) {
        await appendEvent({
          sessionId: ctx.sessionId,
          type: "approval_required",
          toolName: toolCall.name,
          toolInput: toolCall.input,
          payload: {},
        });

        const approved = await ctx.onApprovalRequired(
          toolCall.name,
          toolCall.input,
        );

        if (!approved) {
          await appendEvent({
            sessionId: ctx.sessionId,
            type: "rejected",
            toolName: toolCall.name,
            toolInput: toolCall.input,
            payload: { reason: "user_rejected" },
          });
          toolResults.push(`User rejected the execution of ${toolCall.name}.`);
          continue;
        }

        await appendEvent({
          sessionId: ctx.sessionId,
          type: "approved",
          toolName: toolCall.name,
          toolInput: toolCall.input,
          approvedBy: "user",
          payload: {},
        });
      }

      // executa a tool
      const toolStart = Date.now();
      let toolOutput: unknown;
      let toolError: string | undefined;

      try {
        const skill = ctx.skills.find((s) =>
          s.tools.some((t) => t.name === toolCall.name),
        );
        if (!skill) throw new Error(`No skill found for tool ${toolCall.name}`);

        toolOutput = await skill.execute(toolCall.name, toolCall.input);
      } catch (err) {
        toolError = err instanceof Error ? err.message : String(err);
      }

      const toolDuration = Date.now() - toolStart;

      await appendEvent({
        sessionId: ctx.sessionId,
        type: "tool_result",
        toolName: toolCall.name,
        toolInput: toolCall.input,
        toolOutput: (toolOutput as Record<string, unknown>) ?? {
          error: toolError,
        },
        durationMs: toolDuration,
        payload: {},
      });

      const resultText = toolError
        ? `Error: ${toolError}`
        : JSON.stringify(toolOutput, null, 2);

      await appendMessage(
        ctx.sessionId,
        "tool",
        `${toolCall.name} result: ${resultText}`,
      );

      toolResults.push(resultText);

      // adiciona ao histórico para próxima iteração
      messages.push({
        role: "assistant",
        content: `I'll use ${toolCall.name} to help with this.`,
      });
      messages.push({
        role: "user",
        content: `Tool result for ${toolCall.name}: ${resultText}`,
      });
    }
  }
}

// ─────────────────────────────────────
// LLM abstraction
// ─────────────────────────────────────

interface LLMResponse {
  text?: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  stopReason: string;
  tokensUsed?: number;
}

async function callLLM(opts: {
  provider: "anthropic" | "openai";
  model?: string;
  system: string;
  messages: LLMMessage[];
  tools: ToolDefinition[];
}): Promise<LLMResponse> {
  if (opts.provider === "anthropic") {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic.default();

    const response = await client.messages.create({
      model: opts.model ?? "claude-sonnet-4-5",
      max_tokens: 4096,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    });

    const toolCalls = response.content
      .filter((b: { type: string }) => b.type === "tool_use")
      .map((b: { name: string; input: Record<string, unknown> }) => ({
        name: b.name,
        input: b.input,
      }));

    const text = response.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: response.stop_reason,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    };
  }

  // OpenAI
  const OpenAI = require("openai");
  const client = new OpenAI.default();

  const response = await client.chat.completions.create({
    model: opts.model ?? "gpt-4o",
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
    tools: opts.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
  });

  const choice = response.choices[0];
  const toolCalls = choice.message.tool_calls?.map(
    (tc: { function: { name: string; arguments: string } }) => ({
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    }),
  );

  return {
    text: choice.message.content ?? undefined,
    toolCalls,
    stopReason: choice.finish_reason,
    tokensUsed: response.usage?.total_tokens,
  };
}
