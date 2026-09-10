# ADR 0004: Keep development and production Supabase projects separate

## Status

Accepted.

## Context

The same schema and anonymous guest flow are used locally, in Preview, and in Production. A shared project would make tests and migrations capable of changing public data and would make a bad environment variable particularly costly.

## Decision

Use a hosted development Supabase project for local development and Vercel Preview, and a separate production project for Vercel Production. Every migration command must use an explicit project ref or an intentional linked target. Vercel stores environment-specific variables; Git stores only `.env.example`.

## Consequences

- Preview and integration tests cannot damage production room data.
- Migrations must be applied and verified in each environment.
- A release checklist is required to confirm the Production project ref and variables.
- Database schema changes remain append-only and forward-compatible.
