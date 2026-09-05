# PLAYROOM prototype

This workspace contains the first concept pass for an anonymous multiplayer game portal.

- Product and technical plan: [`PLAN.md`](./PLAN.md)
- Clickable prototype: [`prototype/index.html`](./prototype/index.html)

## Preview locally

From the workspace root:

```powershell
uv run python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/prototype/index.html`.

The prototype is intentionally local-only. Create-room, join-room and theme actions show the intended interaction/state but do not write to Supabase.

## Repository layout

This is a monorepo by design. The platform will live in `app/`, each game has its own module under `games/`, shared contracts live in `packages/`, and Supabase work lives in `supabase/`. Repository-specific Codex instructions and workflows are versioned in `AGENTS.md`, `.agents/skills/`, and `.codex/agents/`.

See [`docs/REPOSITORY-ARCHITECTURE.md`](./docs/REPOSITORY-ARCHITECTURE.md) for the boundary rules and [`docs/decisions/0001-monorepo.md`](./docs/decisions/0001-monorepo.md) for the repository decision.

## Visual variations

The floating dock switches between three directions, and the selected direction is encoded in the URL:

- `?v=night` — 夜市版, the recommended default
- `?v=paper` — 紙牌版
- `?v=citrus` — 青檸版
