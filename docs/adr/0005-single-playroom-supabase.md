# ADR 0005: Use one hosted Supabase project

## Status

Accepted. Supersedes [ADR 0004](0004-separate-supabase-environments.md).

## Context

PLAYROOM is a hobby project. A second hosted database (`playroom-dev`) paused when unused and made local, Preview, and Production diverge. The owner will use the public `playroom` database directly.

## Decision

Local development, Vercel Preview, Vercel Development, and Vercel Production all use the hosted `playroom` project, ref `xrkwxaxsmnraygwsmdiq`, region `ap-northeast-2`. Application code rejects any other Supabase URL. `playroom-dev` is retired and must not be relinked.

Secrets still stay out of Git. `.env.local` and Vercel environment variables may hold the `playroom` service-role key. `NEXT_PUBLIC_APP_URL` may differ by deployment. Migrations use `--project-ref xrkwxaxsmnraygwsmdiq` only.

## Consequences

- Integration tests and Preview write the same rooms database as the public site. Tests must delete only the rooms they create.
- A bad migration or destructive query affects the public database immediately.
- There is no second project in which to rehearse a migration.
