# PLAYROOM repository instructions

## Project identity

This repository is the PLAYROOM anonymous multiplayer game portal. The platform owns the lobby, room lifecycle, guest sessions, shared game contracts, Supabase migrations, and Vercel deployment. Individual games live under `games/` and implement the shared contract without owning the lobby.

Read `docs/REPOSITORY-ARCHITECTURE.md` for the repository map and `PLAN.md` for the product and technical plan. Read a game's nearest `AGENTS.md` before changing that game's rules or code.

## Source boundaries

- Keep platform code in `app/`, shared contracts in `packages/`, game-specific code in `games/`, and database/deployment work in `supabase/`.
- Keep each game's rules in its own `games/<slug>/rules.md`; treat that file as the game rules source of truth.
- Use game-specific room prefixes from `docs/REPOSITORY-ARCHITECTURE.md`: `TIK`, `LAD`, and `CON`.
- Keep `prototype/` as a disposable, local-only experience reference until a production app replaces it.

## Change workflow

1. Read the relevant plan, architecture note, and nearest local instructions.
2. Make the smallest change that satisfies the request.
3. Keep shared contract changes separate from game-specific changes when practical.
4. Run the narrowest relevant check, then the full check before merging to `main`.
5. Report modified files, checks run, and any deferred work.

Completion means the requested files are updated, the relevant check passes, and the final response names any work that is intentionally still a placeholder.

## Git and environment

- Keep `main` releasable; use short-lived feature branches for changes.
- Keep secrets in local or hosted environment variables. Commit `.env.example`, never secret values.
- Treat Supabase migrations as ordered, reviewable source files. Do not edit an applied migration in place; add a new migration.
- Keep local development pointed at the development Supabase project or local Supabase instance, never production.
- The production runnable artifact is the Next.js app under `app/`; from the repository root use the development environment and run `bun run dev`. Keep `prototype/index.html` as a disposable visual reference; serve it with `uv run python -m http.server 4173 --bind 127.0.0.1` only when reviewing the original concept.
- Before installing, launching, or otherwise introducing a new local development or testing tool (for example, Docker Desktop), consult the user and receive explicit approval. Do not run exploratory commands that install or start such tools without that approval.
- Every time when the AI agent complete any code changes with result verified and end the turn to users. Always commit first locally. No need push to origin unless user approve.
- When a safe, in-scope task can be completed directly with the available tools, the AI agent must do it instead of asking the user to run routine commands. Ask the user to take over only for required credentials, authentication or consent, browser handoff, or another action that requires their direct control.

## Agent collaboration

- The primary agent owns production writes and final integration.
- Use subagents for bounded read-heavy work such as architecture review, rule review, test analysis, or release checks.
- Give each subagent a clear scope and output format. Keep simultaneous write scopes disjoint.
- Use the repository skills under `.agents/skills/` for repeatable Playroom workflows.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
<!-- ai-delivery:start v1 -->
## AI delivery workflow

When creating, refining, executing, reviewing, or resuming an AI Work Item, read .ai-delivery/README.md and .ai-delivery/config.yaml before acting.
<!-- ai-delivery:end -->
