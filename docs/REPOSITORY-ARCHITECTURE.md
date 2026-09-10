# PLAYROOM repository architecture

## Decision

PLAYROOM uses one Git repository with modular game projects. A game is independent at the code, rules, test, and adapter boundaries, but remains in the same repository while the platform and games share the same release and deployment lifecycle. The current production entry point is the Next.js app under `app/`; `prototype/` is disposable reference material.

## Directory map

```text
OnlineGame/
├── app/                         # production web app / Vercel entry point
├── games/                       # one folder per game
│   ├── tic-tac-toe/             # TIK-XXX
│   ├── little-stairs/           # LAD-XXX
│   └── connect-four/            # CON-XXX
├── packages/                    # shared code with stable boundaries
│   ├── game-core/
│   ├── room-protocol/
│   └── ui/
├── supabase/                    # migrations, edge functions, seed data
├── docs/                        # product, architecture, operations, ADRs
├── prototype/                   # disposable local-only UI prototype
├── .agents/skills/              # repository-scoped Codex workflows
├── .codex/agents/               # repository-scoped custom subagents
└── AGENTS.md                    # repository instructions
```

## Game boundary

Each game owns:

- rules and rule examples;
- its initial state and legal move validation;
- its game-specific UI;
- game-specific tests;
- its room-code prefix.

The platform owns:

- lobby and catalogue;
- create/join room flows;
- guest identity and room membership;
- persistence, snapshot recovery transport, expiry, and abuse controls;
- the common game adapter contract;
- deployment and environment configuration.

## Room-code prefixes

| Game | Prefix | Example |
| --- | --- | --- |
| Tic-tac-toe / 井字過三關 | `TIK` | `TIK-R77` |
| 小朋友落樓梯 | `LAD` | `LAD-ZHW` |
| Connect Four / 四子棋 | `CON` | `CON-K8P` |

The prefix is a recognition and routing hint, not a security boundary. The server owns uniqueness, expiry, and authorization.

## When to split a game into its own repository

Split only when a game has an independent team, deployment, licensing boundary, release cadence, or reuse outside PLAYROOM. Until then, a monorepo keeps cross-cutting room and contract changes atomic and keeps the weekend project operationally small.

