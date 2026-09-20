/**
 * Custom Sandcastle AgentProvider for the Grok CLI (`grok`).
 *
 * Headless AFK:
 *   (stdin → temp file) grok --prompt-file $TMP \
 *     --output-format streaming-messages-json \
 *     --always-approve \
 *     [-m MODEL] [--resume SESSION] [--fork-session]
 *
 * Stream support: full (text / tool_call / result / session_id / usage)
 * via `--output-format streaming-messages-json`.
 *
 * Resume support: best-effort. `--resume` is wired when Sandcastle passes
 * `resumeSession`. Full Sandcastle session capture/transfer is disabled
 * (`captureSessions: false`) because Grok stores sessions as multi-file
 * directories under `~/.grok/sessions/`, not a single JSONL file.
 *
 * Auth: host `~/.grok/auth.json` (`grok login`) or `XAI_API_KEY` in env
 * (required inside Docker sandboxes / CI).
 */
import type {
  AgentCommandOptions,
  AgentProvider,
  IterationUsage,
  PrintCommand,
} from "@ai-hero/sandcastle";

/** Local mirror of Sandcastle's ParsedStreamEvent (not re-exported by the package). */
export type GrokStreamEvent =
  | { type: "text"; text: string }
  | { type: "result"; result: string }
  | { type: "tool_call"; name: string; args: string }
  | { type: "session_id"; sessionId: string }
  | { type: "usage"; usage: IterationUsage };

export interface GrokProviderOptions {
  /** Override model id (default: GROK_MODEL env, else grok-4.6). */
  readonly model?: string;
  /** Extra env merged into the provider env. */
  readonly env?: Record<string, string>;
  /**
   * Path to the `grok` binary. Default: `grok` on PATH
   * (Cloud host: `~/.grok/bin` via profile PATH).
   */
  readonly binary?: string;
}

const shellEscape = (s: string): string =>
  "'" + s.replace(/'/g, `'\\''`) + "'";

const resolveModel = (options?: GrokProviderOptions): string =>
  options?.model?.trim() ||
  process.env.GROK_MODEL?.trim() ||
  "grok-4.6";

const asNumber = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const mapUsage = (
  usage: Record<string, unknown>,
): IterationUsage | undefined => {
  const inputTokens =
    asNumber(usage.input_tokens) ?? asNumber(usage.inputTokens);
  const outputTokens =
    asNumber(usage.output_tokens) ?? asNumber(usage.outputTokens);
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  return {
    inputTokens,
    cacheCreationInputTokens:
      asNumber(usage.cache_creation_input_tokens) ??
      asNumber(usage.cacheCreationInputTokens) ??
      0,
    cacheReadInputTokens:
      asNumber(usage.cache_read_input_tokens) ??
      asNumber(usage.cacheReadInputTokens) ??
      0,
    outputTokens,
  };
};

/**
 * Parse one NDJSON line from `grok --output-format streaming-messages-json`.
 * Also accepts a few native `streaming-json` shapes as a fallback.
 */
export const parseGrokStreamLine = (line: string): GrokStreamEvent[] => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return [];
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const events: GrokStreamEvent[] = [];

    if (
      obj.type === "system" &&
      obj.subtype === "init" &&
      typeof obj.session_id === "string"
    ) {
      events.push({ type: "session_id", sessionId: obj.session_id });
    }

    if (obj.type === "assistant") {
      const message = obj.message as
        | { content?: unknown; usage?: Record<string, unknown> }
        | undefined;
      const content = message?.content;
      if (Array.isArray(content)) {
        const texts: string[] = [];
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const b = block as Record<string, unknown>;
          if (b.type === "text" && typeof b.text === "string") {
            texts.push(b.text);
          } else if (
            b.type === "tool_use" &&
            typeof b.name === "string" &&
            b.input !== undefined
          ) {
            if (texts.length > 0) {
              events.push({ type: "text", text: texts.join("") });
              texts.length = 0;
            }
            events.push({
              type: "tool_call",
              name: b.name,
              args:
                typeof b.input === "string"
                  ? b.input
                  : JSON.stringify(b.input),
            });
          }
        }
        if (texts.length > 0) {
          events.push({ type: "text", text: texts.join("") });
        }
      }
      if (message?.usage && typeof message.usage === "object") {
        const mapped = mapUsage(message.usage);
        if (mapped) events.push({ type: "usage", usage: mapped });
      }
      if (typeof obj.session_id === "string") {
        events.push({ type: "session_id", sessionId: obj.session_id });
      }
    }

    // Native streaming-json fallbacks
    if (obj.type === "text" && typeof obj.data === "string") {
      events.push({ type: "text", text: obj.data });
    }
    if (obj.type === "tool_call") {
      const name = obj.toolName ?? obj.name;
      if (typeof name === "string") {
        const raw = obj.rawInput ?? obj.input ?? obj.args ?? {};
        events.push({
          type: "tool_call",
          name,
          args: typeof raw === "string" ? raw : JSON.stringify(raw),
        });
      }
    }
    if (obj.type === "end") {
      if (typeof obj.sessionId === "string") {
        events.push({ type: "session_id", sessionId: obj.sessionId });
      }
      if (obj.usage && typeof obj.usage === "object") {
        const mapped = mapUsage(obj.usage as Record<string, unknown>);
        if (mapped) events.push({ type: "usage", usage: mapped });
      }
    }

    if (obj.type === "result") {
      if (typeof obj.result === "string") {
        events.push({ type: "result", result: obj.result });
      } else if (typeof obj.message === "string") {
        events.push({ type: "result", result: obj.message });
      }
      if (typeof obj.session_id === "string") {
        events.push({ type: "session_id", sessionId: obj.session_id });
      }
      if (obj.usage && typeof obj.usage === "object") {
        const mapped = mapUsage(obj.usage as Record<string, unknown>);
        if (mapped) events.push({ type: "usage", usage: mapped });
      }
    }

    return events;
  } catch {
    return [];
  }
};

/** Create a Grok AgentProvider for Sandcastle. */
export const grok = (options?: GrokProviderOptions): AgentProvider => {
  const model = resolveModel(options);
  const binary = options?.binary?.trim() || "grok";

  return {
    name: "grok",
    env: {
      ...(process.env.XAI_API_KEY
        ? { XAI_API_KEY: process.env.XAI_API_KEY }
        : {}),
      ...(options?.env ?? {}),
    },
    captureSessions: false,
    buildPrintCommand({
      prompt,
      resumeSession,
      forkSession,
    }: AgentCommandOptions): PrintCommand {
      // Always --always-approve in print/AFK mode. noSandbox() sets
      // dangerouslySkipPermissions=false, but headless AFK still needs
      // auto-approve or the agent blocks on permission prompts.
      const modelFlag = ` -m ${shellEscape(model)}`;
      const resumeFlag = resumeSession
        ? ` --resume ${shellEscape(resumeSession)}`
        : "";
      const forkFlag =
        resumeSession && forkSession ? " --fork-session" : "";

      // noSandbox + non-TTY: grok --prompt-file /dev/stdin fails with
      // "No such device or address". Pipe Sandcastle stdin into a temp file
      // first, then point --prompt-file at that path.
      return {
        command:
          `PROMPT_FILE=$(mktemp) && cat > "$PROMPT_FILE" && ` +
          `${shellEscape(binary)} --prompt-file "$PROMPT_FILE" --output-format streaming-messages-json --always-approve${modelFlag}${resumeFlag}${forkFlag}; ` +
          `EC=$?; rm -f "$PROMPT_FILE"; exit $EC`,
        stdin: prompt,
      };
    },
    buildInteractiveArgs({
      prompt,
      dangerouslySkipPermissions,
      resumeSession,
      forkSession,
    }: AgentCommandOptions): string[] {
      const args = [binary, "-m", model];
      if (dangerouslySkipPermissions) args.push("--always-approve");
      if (resumeSession) args.push("--resume", resumeSession);
      if (resumeSession && forkSession) args.push("--fork-session");
      if (prompt) args.push(prompt);
      return args;
    },
    parseStreamLine(line: string): GrokStreamEvent[] {
      return parseGrokStreamLine(line);
    },
  };
};

export default grok;
