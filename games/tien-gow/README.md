# 打天九 / Tien Gow

- Slug: `tien-gow`
- Room prefix: `TGW`
- Players: 4, empty seats filled with CPU
- Mode: turn-based only
- Status: engine + `/lab/tien-gow` + Playroom `TGW` rooms (1–4 humans, CPU fill, seat-relative views).

`rules.md` — play.
`SPEC.md` — TDD implementation.
`CONTEXT.md` — terms.
`docs/test-plan.md` — lab UAT; pin deals with `?seed=` / `?fixture=`.

## Playroom Table (lab defaults)

Host sets Table checkboxes in the lobby. They lock at start and stay on the room for rematch / next hand. Defaults match lab / `rules.md` / `DEFAULT_TABLE`:

| Option | Default |
| --- | --- |
| `wenHonor` 文尊 | on |
| `captureWenHonor` 擒文尊 | on |
| `yaoSettle` 么結 | on |
| `yaoCapture` 么雙擒四 | on |
| `baoHonor` 包尊 | on |
| `fourBless` 賀四 / 四大包 | on |
| `slam` 七支 / 八支 | on |
| `examples` 例牌 | on |
| `baoHonorAlsoHe` 包尊亦賀 | off |
| `extraExamples` 額外例牌 | off |

After 結, the recap shows 棟 / chips / payments. **下一局** keeps chips and 飛莊 (結 seat is 莊 next). **重開牌局** resets chips to 100 and keeps the same seats and Table; 莊 is re-drawn from the next seed (Playroom first-hand rule), not forced to 南 as in the lab. Room status stays `playing`. Playroom has no `god` view.
