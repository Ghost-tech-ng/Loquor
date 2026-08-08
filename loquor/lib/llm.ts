// The one place that knows how to talk to a language model.
//
// Extracted at Phase 3. Two judges could each carry their own copy of the Groq
// and Anthropic request shapes; six cannot. The bodies are not quite the same
// between vendors — Groq takes a `json_schema` response format, Anthropic has no
// such thing and expresses the schema as a tool it is forced to call — and that
// difference is exactly the kind of detail that drifts when it lives in six
// files and only one of them gets fixed.
//
// Two entry points, because the product asks two different things of a model:
//
//   structured()  a guaranteed-conformant object. Every judge. temperature 0,
//                 because a scorecard that reads differently on Tuesday is worse
//                 than no scorecard.
//   converse()    free prose, one turn of a role-play. Warm on purpose: a
//                 counterpart who answers identically every time is a script,
//                 and the whole point of the drill is that it is not.
//
// No delivery metric ever crosses this boundary. Those are arithmetic (metrics.ts)
// and the model is never asked to guess at them.

export type Provider = "groq" | "anthropic";

export class LLMError extends Error {}

const GROQ_MODEL = "openai/gpt-oss-120b";
const ANTHROPIC_MODEL = "claude-sonnet-5";

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * A JSON-schema-constrained call. `name` labels the schema for the vendor and
 * shows up in nothing the user sees; keep it snake_case and stable.
 */
export async function structured(
  args: {
    system: string;
    user: string;
    schema: object;
    name: string;
    maxTokens?: number;
  },
  provider: Provider,
  apiKey: string
): Promise<{ data: Record<string, unknown>; latencyMs: number }> {
  requireKey(provider, apiKey);
  const t0 = Date.now();
  const data =
    provider === "groq"
      ? await groqStructured(args, apiKey)
      : await anthropicStructured(args, apiKey);
  return { data, latencyMs: Date.now() - t0 };
}

/**
 * One turn of prose. `temperature` defaults to 0.8 — this path exists for the
 * role-play counterpart, and a counterpart that says the same sentence every
 * time teaches you to answer that sentence rather than to answer a person.
 */
export async function converse(
  args: { system: string; turns: Turn[]; maxTokens?: number; temperature?: number },
  provider: Provider,
  apiKey: string
): Promise<{ text: string; latencyMs: number }> {
  requireKey(provider, apiKey);
  const t0 = Date.now();
  const text =
    provider === "groq" ? await groqChat(args, apiKey) : await anthropicChat(args, apiKey);
  return { text: text.trim(), latencyMs: Date.now() - t0 };
}

function requireKey(provider: Provider, apiKey: string): void {
  if (!apiKey) throw new LLMError(`No ${label(provider)} API key. Add one in Settings.`);
}

function label(p: Provider): string {
  return p === "groq" ? "Groq" : "Anthropic";
}

// ── Groq ──────────────────────────────────────────────────────────────────────

async function groqStructured(
  args: { system: string; user: string; schema: object; name: string; maxTokens?: number },
  apiKey: string
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_completion_tokens: args.maxTokens ?? 1024,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: args.name, strict: true, schema: args.schema },
      },
    }),
  });

  if (!res.ok) throw new LLMError(await errorText(res, "Groq"));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson(json.choices?.[0]?.message?.content);
}

async function groqChat(
  args: { system: string; turns: Turn[]; maxTokens?: number; temperature?: number },
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: args.temperature ?? 0.8,
      max_completion_tokens: args.maxTokens ?? 300,
      messages: [{ role: "system", content: args.system }, ...args.turns],
    }),
  });

  if (!res.ok) throw new LLMError(await errorText(res, "Groq"));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new LLMError("The model returned an empty reply.");
  return text;
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async function anthropicStructured(
  args: { system: string; user: string; schema: object; name: string; maxTokens?: number },
  apiKey: string
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 1024,
      temperature: 0,
      system: args.system,
      tools: [
        { name: args.name, description: "Record the result.", input_schema: args.schema },
      ],
      tool_choice: { type: "tool", name: args.name },
      messages: [{ role: "user", content: args.user }],
    }),
  });

  if (!res.ok) throw new LLMError(await errorText(res, "Anthropic"));
  const json = (await res.json()) as {
    content?: { type: string; input?: Record<string, unknown> }[];
  };
  const block = json.content?.find((c) => c.type === "tool_use");
  if (!block?.input) throw new LLMError("Anthropic returned no result.");
  return block.input;
}

async function anthropicChat(
  args: { system: string; turns: Turn[]; maxTokens?: number; temperature?: number },
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 300,
      temperature: args.temperature ?? 0.8,
      system: args.system,
      messages: args.turns,
    }),
  });

  if (!res.ok) throw new LLMError(await errorText(res, "Anthropic"));
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = json.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new LLMError("The model returned an empty reply.");
  return text;
}

// ── shared ────────────────────────────────────────────────────────────────────

function parseJson(content: string | undefined): Record<string, unknown> {
  if (!content) throw new LLMError("The model returned an empty response.");
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new LLMError("The model returned malformed JSON.");
  }
}

async function errorText(res: Response, vendor: string): Promise<string> {
  // The body is echoed for diagnosis but never the request — the request carries
  // the key in a header and a logged request is a leaked key.
  const body = await res.text().catch(() => "");
  if (res.status === 401) return `${vendor} rejected the API key. Check it in Settings.`;
  if (res.status === 429) return `${vendor} rate limit hit. Wait a moment and try again.`;
  return `${vendor} error ${res.status}. ${body.slice(0, 180)}`;
}

/** 0–4 rubric coercion. Anything unparseable is a 0, never a silent 3. */
export function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(4, Math.max(0, v));
}

export function str(v: unknown): string {
  return String(v ?? "").trim();
}
