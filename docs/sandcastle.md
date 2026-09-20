# Sandcastle + Grok on OnlineGame

Sandcastle orchestrates AFK coding agents against GitHub issues. This repo
wires a **custom Grok `AgentProvider`** because Cloud Agents (Cursor) are
unavailable on the current plan, and the Cloud computer has **no Docker**.

## Labels

| Label | Purpose |
| --- | --- |
| `Sandcastle` | Issue is in the Sandcastle queue (required filter) |
| `ready-for-agent` | Issue is fully specified and safe for AFK execution |

Do **not** use Helic legacy `ai:*` labels for Sandcastle selection.

Create the Sandcastle label if missing:

```bash
gh label create Sandcastle --description "Issues for Sandcastle to work on" --color F9A825
```

`ready-for-agent` already exists on this repo.

## Cloud computer (no Docker)

Default sandbox is `noSandbox()` from
`@ai-hero/sandcastle/sandboxes/no-sandbox`.

```bash
cd /workspace/IT/My-AI-Portfolio/Projects/OnlineGame

# One-time: deps (bun workspaces)
bun install

# Auth: either `grok login` on the host, or set XAI_API_KEY in .sandcastle/.env
cp .sandcastle/.env.example .sandcastle/.env   # optional on Cloud if grok+gh already logged in

# Smoke / single iteration (does not AFK-loop open issues unless labeled Sandcastle)
bun run sandcastle
```

Equivalent:

```bash
SANDCASTLE_SANDBOX=none SANDCASTLE_MAX_ITERATIONS=1 \
  bun --env-file=.sandcastle/.env .sandcastle/main.mts
```

### Exact run command (Cloud)

```bash
bun run sandcastle
```

## Docker (optional, when available)

```bash
# Build image (installs Grok CLI via https://grok.com/install.sh)
bunx sandcastle docker build-image --image-name sandcastle:onlinegame

# Run with Docker sandbox
SANDCASTLE_SANDBOX=docker XAI_API_KEY=... GH_TOKEN=... bun run sandcastle
```

Docker is **not** available on the current Cloud computer (`docker` missing,
no docker.sock). Keep the Dockerfile for later.

## Layout

```
.sandcastle/
  main.mts           # run() entry — Grok + noSandbox/docker switch
  grok-provider.ts   # custom AgentProvider
  prompt.md          # filters issues with label Sandcastle
  Dockerfile         # installs grok CLI for future Docker runs
  .env.example       # XAI_API_KEY, GH_TOKEN, SANDCASTLE_SANDBOX
  .env               # local secrets (gitignored)
  .gitignore         # .env, logs/, worktrees/
```

## Grok stream / resume support

| Capability | Status |
| --- | --- |
| Streaming text / tool_call / result / usage | **Full** via `--output-format streaming-messages-json` |
| Session id in stream | **Full** (`system/init` + `result.session_id`) |
| `--resume` / `--fork-session` CLI flags | **Wired** in the provider |
| Sandcastle session capture / host↔sandbox transfer | **Best-effort only** — disabled (`captureSessions: false`) because Grok sessions are multi-file directories under `~/.grok/sessions/` |

## Safety

- Do not start a live AFK issue-fixing loop against unlabeled or HUD issues (#32–#35) unless intentionally queued with `Sandcastle`.
- Never commit `.sandcastle/.env`.
- Prefer `SANDCASTLE_MAX_ITERATIONS=1` for smoke tests.
