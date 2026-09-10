# ADR 0003: Use temporary anonymous guest sessions

## Status

Accepted for the first public release.

## Context

PLAYROOM is designed for a short game flow without account creation. The platform still needs an authenticated subject to authorize room membership and API commands.

## Decision

The browser creates a Supabase anonymous Auth session and sends its bearer token to the route handlers. The guest ID is scoped to the temporary session and room membership. Display names are labels, not identity. A footer privacy notice states that operational logs and abuse controls may apply.

## Consequences

- Visitors can play without email, password, or social login.
- Anonymous sign-in must remain enabled in each target Supabase project.
- Auth rate limits and application rate limits are required to prevent session and room abuse.
- Support uses room codes and timestamps; it must not request guest credentials.
- If permanent accounts are added later, the migration must preserve the room authorization model and privacy expectations.
