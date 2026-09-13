# 打天九 local instructions

- Prefix `TGW`. Mode `turn_based` only.
- Play: `rules.md`. Terms: `CONTEXT.md`. Implement: `SPEC.md`.
- TDD: for each SPEC slice, add failing tests, then code until `bun test` is green. Do not start the next slice until the current one is green.
- Validate moves in the engine, not the browser.
- Keep lobby, Supabase, and shared protocol unchanged unless the issue includes that boundary.
