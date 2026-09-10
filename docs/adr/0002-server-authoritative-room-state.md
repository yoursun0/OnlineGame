# ADR 0002: Keep room state server-authoritative

## Status

Accepted.

## Context

Guests need fast multiplayer updates and must recover after refresh, reconnect, or a missed browser event. A client-authoritative board would allow invalid turns, stale writes, and divergent room state.

## Decision

Next.js route handlers authenticate the Supabase guest token, load the canonical room snapshot, validate the game move through the game adapter, and persist the new snapshot plus event with an optimistic version check. The database owns membership, seats, status, expiry, and event ordering. Clients render the latest snapshot and may request events after a known version.

## Consequences

- Invalid moves and stale concurrent moves are rejected centrally.
- Refresh/reconnect can recover from Postgres rather than relying on browser memory.
- Every move costs a server/database request, so request limits and payload bounds are part of the design.
- A future Realtime transport may reduce latency, but it must not become the source of truth.
