# 打天九 rules

Source of truth for play. Scores in 棟, not money.

## Setup

- 4 players, seats 0–3 counterclockwise, 32 tiles, 8 each
- Empty seats are CPU so every hand has 4 players
- Counterclockwise, 飛莊 (結 player is 莊 next)
- Seeded shuffle. First 莊 is a seeded random seat

## Table

Locked before the first hand. Unchanged for the room. CPU uses the same Table.

Always on: 格食格, 墊牌 face down, 上家不打下家不墊, equal-rank 武子 cannot beat, 武尊 lead-only unbeatable, 准拆 (lead may play part of a larger set).

| Option | Default | Effect if on |
| --- | --- | --- |
| `wenHonor` | on | 孖伶冧 is 文尊 |
| `captureWenHonor` | on | ignored unless `wenHonor`. 孖高腳 beats led 文尊 |
| `yaoSettle` | on | 么三 么結. 伶冧六 么結 only if `wenHonor` |
| `yaoCapture` | on | ignored unless `yaoSettle`. 么雙擒四 |
| `baoHonor` | on | 包尊. No 賀錢 on that trick |
| `fourBless` | on | 賀四 and 四大包 |
| `slam` | on | 七支 / 八支 |
| `examples` | on | 一點紅, 七武, 全白, 八武 |
| `baoHonorAlsoHe` | off | 包尊 / 四大包 also collect 賀錢, then 結 multiplier |
| `extraExamples` | off | 四對子, 七星文士, 八方文士 |

`wenHonor` off: 孖伶冧 is 文對. `wenHonor` on and `captureWenHonor` off: 文尊 is lead-only unbeatable.

## Tiles

1 and 4 pips are red; other pips are white. 天's sixes also paint two centre pips red (display only; 例牌 still counts 1s and 4s).

### 文子, high to low, two of each

| Rank | Name | Pips | Red |
| --- | --- | --- | --- |
| 1 | 天 | 6-6 | 0 |
| 2 | 地 | 1-1 | 2 |
| 3 | 人 | 4-4 | 2 |
| 4 | 和 / 鵝 | 1-3 | 1 |
| 5 | 梅花 | 5-5 | 0 |
| 6 | 長三 | 3-3 | 0 |
| 7 | 板凳 | 2-2 | 0 |
| 8 | 斧頭 | 5-6 | 0 |
| 9 | 紅頭十 | 4-6 | 1 |
| 10 | 高腳七 | 1-6 | 1 |
| 11 | 伶冧六 | 1-5 | 1 |

### 武子, high to low

Same pip total is equal.

| Rank | Name | Pips | Red |
| --- | --- | --- | --- |
| 1 | 九 | 3-6, 4-5 | 0, 1 |
| 2 | 八 | 3-5, 2-6 | 0, 0 |
| 3 | 七 | 3-4, 2-5 | 1, 0 |
| 4 | 大頭六（大雞） | 2-4 | 1 |
| 5 | 五 | 2-3, 1-4 | 0, 2 |
| 6 | 么三（細雞） | 1-2 | 1 |

## Combinations

Lead 1–4 tiles of one class. Followers beat that class or 墊. Classes do not beat each other.

Aliases: 寶子 = 文對, 雜子 = 武對. 三文天九 / 三武天九 / 四天九 means the 天九·地八·人七·和五 family.

| Class | What | Rank |
| --- | --- | --- |
| 單文 | one 文子 | 天 > … > 伶冧六 |
| 單武 | one 武子 | 九 > 八 > 七 > 六 > 五 > 三 |
| 文對 | two identical 文子 | same as 單文 |
| 武對 | 雜九 > 雜八 > 雜七 > 雜五 | no 雜六 / 雜三 |
| 文武對 | matching 文 + 武 | 天九 > 地八 > 人七 > 和五 |
| 三文 | 文對 + matching 武 | same family order |
| 三武 | 武對 + matching 文 | same family order |
| 四文武 | 文對 + 武對 of that family | same family order |
| 至尊 | 么三 + 大頭六 | lead wins; beats nothing |
| 文尊 | 孖伶冧 if `wenHonor` | lead wins unless `captureWenHonor` and 孖高腳 |

Equal rank cannot beat. Face-up combo stays until a strictly higher same-class play.

## Trick

莊 leads the first trick. Trick winner leads the next.

- Leader: one legal combination, face up
- Others: strictly higher same class, face up, or 墊 that many tiles face down
- 墊 is always legal, even if the seat could beat
- Won tiles become 棟 (one 棟 per tile)
- Face-up tiles are public. 墊牌 stay hidden until the hand recap

## 結

Last-trick winner 結, except a seat with 0 棟 after seven tiles played (singleton last trick) must 墊 and cannot 結. If the last trick is two or more tiles, 0 棟 may still beat (winning yields ≥2 棟).

## Ordinary scoring

Losers settle only with the 結 player. Par 4.

| 棟 | Net |
| --- | --- |
| 0 | -5 |
| 1 | -3 |
| 2 | -2 |
| 3 | -1 |
| 4 | 0 |
| 5 | +1 |
| 6 | +2 |

莊家倍數: n = consecutive 莊 hands including this one, starting at 1. Multiplier = n+1 (初任 ×2, 加一莊 ×3, …). Apply when 結 or the loser is 莊, except a losing 莊 with net > 0 uses 1. Two non-莊 seats use 1.

結 player receives the sum of those payments. Each seat starts at 100 棟. Hands continue. Chips may go negative.

## Immediate payments

Independent of 結, unless the trick is 包尊 / 四大包 and `baoHonorAlsoHe` is off.

莊家倍數 applies when 莊 pays or is paid.

**賀尊:** lead 武尊, or 文尊 if enabled. Others 墊. Collector gets 2 from each non-莊 and 2 × 莊家倍數 from 莊; if collector is 莊, each other seat pays 2 × 莊家倍數. Collector leads next.

**擒文尊:** `wenHonor` and `captureWenHonor`. 孖高腳 beats led 文尊, collects as 賀尊, leads next.

**賀四:** win a non-final 四文武 trick. Base 4 instead of 2. Highest 四文武 on the trick collects.

Last-trick 至尊 / 四文武 is 包尊 / 四大包, not 賀.

## Special 結

Compute ordinary nets first. Extra multipliers apply to what 結 **wins** from seats below par. They do not inflate 入一 / 入二 paid out by 結.

| Name | Last trick | Extra |
| --- | --- | --- |
| 包尊 | 至尊 (武尊, or unbeaten 文尊) | ×2 |
| 四大包 | 四文武 | ×4 |
| 么結 | singleton 么三, or 伶冧六 if `wenHonor` | ×2 |
| 么雙擒四 | 大頭六 結 a led 么三 么結, or 高腳七 結 a led 伶冧六 么結 | captured seat covers below-par losses (after 莊 multiplier), then ×4. 入一 / 入二 still paid by 結, not ×4 |

Beating 么 with a non-capturing tile, or capturing without 結, is ordinary play.

## 七支 / 八支

結 with all 8 棟.

**八支** if the last trick is 明面最大 (unbeatable face-up singleton), the minimum singleton (么三; 伶冧六 if `wenHonor`), or a pair or larger. Otherwise **七支**.

If 結 already has 7 棟 and others cannot contest the last singleton, that tile is forced: **七支**.

莊 八支: 莊's first lead of the hand was not 天, 九, or 至尊. If it was, a slam is 七支.

七支 ×2, 八支 ×4, stacked with 包尊 / 么結 / 四大包. Empty base 5 before slam (七支 empty 10, 八支 empty 20), then 莊 multiplier.

## 例牌

If `examples`, after deal before the first lead.

| Hand | Slam |
| --- | --- |
| 一點紅 — exactly one red pip | 七支 |
| 七武 — seven 武子 | 七支 |
| 全白 — zero red pips | 八支 |
| 八武 — eight 武子 | 八支 |

`extraExamples`: 四對子 (four 文對 and/or 武對, not 文武對) 八支; 七星文士 七支; 八方文士 八支.

If several qualify, 莊 wins; else next eligible counterclockwise from 莊. That seat 結 immediately with the slam multiplier. No tricks. 莊家倍數 still applies.
