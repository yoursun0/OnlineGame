# 打天九 local instructions

- Keep the room prefix as `TGW`.
- Read `rules.md` before changing game behavior. That file is the Helic table, the source of truth.
- Read `SPEC.md` before changing adapter shape, hidden views, CPU, or platform wiring.
- Read `PROTOTYPE.md` before adding the lab page or a nested prototype app.
- Use `CONTEXT.md` terms. Do not rename 棟, 結, 墊牌, 賀尊, or 文尊.
- Mode is turn-based only.
- Keep move validation deterministic and independent of the browser.
- Do not change lobby, Supabase schema, or shared protocol files as part of a game-only change unless the task explicitly includes that boundary.
- Add or update focused game tests with every rules change.
- Implement against `GameAdapter` from the first coding session. Do not add a disposable HTML prototype.
