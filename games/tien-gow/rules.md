# 打天九 rules

This is the source of truth for PLAYROOM 打天九. The **Helic table** is canonical. Wikipedia, tin9club, and Alone in the Fart are references only.

PLAYROOM scores in 棟. There is no money.

## Identity

- Slug: `tien-gow`
- Prefix: `TGW`
- Players: 4
- Mode: `turn_based`
- Seats: 0, 1, 2, 3 counterclockwise
- Occupants: humans and CPU. Empty seats fill with CPU so every hand has 4 players

## Table

The host locks a Table before the first hand. CPU plays that Table. Changing Table mid-room is not allowed.

### Always on

- 32 tiles, 8 each, no 小天九, no 推牌九
- Counterclockwise play, 飛莊
- 格食格: beat only the same combination class with a strictly higher rank
- 墊牌: same tile count, face down
- 上家不打，下家不墊
- Equal-rank 武子 cannot beat each other
- 武尊 is lead-only and unbeatable
- 結 eligibility: last trick, and at least 2 棟 at hand end. After 7 tiles, a player with 0 棟 must 墊 a singleton last trick
- Par 4 棟. 空棟 scores as -5. 入一 / 入二 exist
- 莊家倍數: 初任 x2, 加一莊 x3, 加二莊 x4. n = consecutive 莊 hands including the hand being settled, starting at 1. Multiplier = n+1
- Losing 莊 who 入一 / 入二 is not doubled
- 准拆: a lead may play part of a larger set
- Deal is a uniform random partition into four hands of 8. 牌頭 names are cosmetic later, not fairness rules

### Options

Helic default is ON unless marked.

| Option | Default | Notes |
| --- | --- | --- |
| `wenHonor` 文尊 | ON | 孖伶冧 is 文尊 |
| `captureWenHonor` 擒文尊 | ON | Only if 文尊 is on. 孖高腳 may beat led 文尊 |
| `yaoSettle` 么結 | ON | 三雞 么結 always. 伶冧六 么結 only if 文尊 is on |
| `yaoCapture` 么雙擒四 | ON | Only if 么結 is on |
| `baoHonor` 包尊 | ON | 結 with 至尊. No 賀錢 on that trick |
| `fourBless` 賀四 / 四大包 | ON | Mid-hand 賀四 and 結 四大包 |
| `slam` 七支 / 八支 | ON | |
| `examples` 例牌 | ON | Helic set only: 一點紅, 七武, 全白, 八武 |
| `baoHonorAlsoHe` 包尊兼賀 | OFF | If on, 包尊 / 四大包 also collect 賀錢 then apply 結 multiplier |
| `extraExamples` | OFF | 四對子, 七星文士, 八方文士 |

If `wenHonor` is off, `captureWenHonor` is ignored and 孖伶冧 is an ordinary 寶子.

If `wenHonor` is on and `captureWenHonor` is off, 文尊 is lead-only and unbeatable, same as 武尊.

## Tiles

32 tiles. 1 and 4 pips are red; other pips are white. That coloring is used for 例牌.

### 文子, high to low, two of each

| Rank | Name | Pips | Red pips |
| --- | --- | --- | --- |
| 1 | 天 | 6-6 | 0 |
| 2 | 地 | 1-1 | 2 |
| 3 | 人 | 4-4 | 2 |
| 4 | 和 / 鵝 | 1-3 | 1 |
| 5 | 梅花 | 5-5 | 0 |
| 6 | 長三 / 長衫 | 3-3 | 0 |
| 7 | 板凳 | 2-2 | 0 |
| 8 | 斧頭 | 5-6 | 0 |
| 9 | 屏風 / 紅頭十 | 4-6 | 1 |
| 10 | 高腳七 | 1-6 | 1 |
| 11 | 伶冧六 | 1-5 | 1 |

### 武子, high to low

Same pip total is equal. Faces differ; function does not.

| Rank | Name | Pips | Red pips |
| --- | --- | --- | --- |
| 1 | 九 | 3-6, 4-5 | 0, 1 |
| 2 | 八 | 3-5, 2-6 | 0, 0 |
| 3 | 七 | 3-4, 2-5 | 1, 0 |
| 4 | 六 / 大頭六 | 2-4 | 1 |
| 5 | 五 | 2-3, 1-4 | 0, 2 |
| 6 | 三 / 三雞 | 1-2 | 1 |

## Combinations

A lead chooses one class and 1-4 tiles. Followers beat that class or 墊.

House shorthand 寶子 = 文對, 雜子 = 武對, 三文天九 / 三武天九 / 四天九 = the whole 天九/地八/人七/和五 family.

### Classes, cannot beat across class

1. 單文
2. 單武
3. 文對 / 寶子
4. 武對 / 雜子
5. 文武對
6. 三文
7. 三武
8. 四文武
9. 至尊 (and 文尊 when enabled; 文尊 is its own lead-only class, beaten only by 孖高腳 if `captureWenHonor`)

### Rank inside class

**單文 / 文對:** 天 > 地 > 人 > 和 > 梅 > 長三 > 板凳 > 斧頭 > 屏風 > 高腳七 > 伶冧六

**單武:** 九 > 八 > 七 > 六 > 五 > 三

**武對:** 雜九 > 雜八 > 雜七 > 雜五. There is no 雜六 or 雜三.

**文武對 / 三文 / 三武 / 四文武:** 天九 > 地八 > 人七 > 和五

- 文武對 = one matching 文 + one matching 武
- 三文 = 文對 + one matching 武
- 三武 = 武對 + one matching 文
- 四文武 = 文對 + 武對 of that family

**至尊:** 三雞 + 大頭六 only. Lead wins. Cannot beat any other class.

**文尊:** 伶冧六 + 伶冧六, if `wenHonor`. Lead wins unless `captureWenHonor` and a later player plays 高腳七 + 高腳七.

Equal rank cannot beat. Equal 武 faces are equal. The current face-up combination stays until a strictly higher same-class play.

## Deal and lead

First 莊 of a room: random seat (local prototype may use host). Later 莊 = previous 結 player.

Shuffle with a seed. Each seat gets 8 tiles.

If `examples` is on, after deal and before the first lead there is an 例牌 window. See 例牌.

莊 leads the first trick. Winner of a trick leads the next.

## Trick

On a player's turn:

- If they are the leader: play a legal combination from hand, face up
- Else: either play a strictly higher same-class combination face up, or 墊 that many tiles face down

A player may 墊 even if they could beat.

Tiles in a won trick become that player's 棟, one 棟 per tile.

Revealed (face-up) tiles stay public. 墊牌 stay hidden for the rest of the room. After the hand, 墊牌 may be shown in the recap.

## 結 eligibility

The player who wins the last trick 結, except:

- A player with 0 棟 after 7 tiles have been played from each hand (i.e. one tile left, last trick is a singleton) must 墊 and cannot 結
- If the last trick is two or more tiles, a player with 0 棟 may still beat, because winning that trick yields at least 2 棟

Helic note "頭七隻，最少要有一棟，先有資格結" is this rule.

## Scoring, ordinary 結

Losers settle only with the 結 player.

Net 棟 vs par 4:

| 棟 | Net |
| --- | --- |
| 0 | -5 |
| 1 | -3 |
| 2 | -2 |
| 3 | -1 |
| 4 | 0 |
| 5 | +1 |
| 6 | +2 |

If 莊 is involved in a payment (結 is 莊, or loser is 莊), multiply by 莊家倍數, except: a losing 莊 who has net > 0 (入一 / 入二) uses multiplier 1.

Two non-莊 players use multiplier 1.

結 player receives the sum of others' payments (positive from losers, negative if paying 入一 / 入二).

Starting chips: 100 棟 each. Hands continue in the same room. Chips may go negative. The room does not end at 0.

## 賀尊, 擒文尊, 賀四

These pay immediately, independent of later 結, unless the same trick is 包尊 / 四大包 and `baoHonorAlsoHe` is off (Helic default).

莊家倍數 applies to any payment that includes 莊.

**賀尊:** leader plays 武尊, or 文尊 when enabled. Others must 墊. Collector receives 2 from each non-莊, and 2 * 莊家倍數 from 莊; if collector is 莊, each other player pays 2 * 莊家倍數. Then collector leads the next trick.

**擒文尊:** only if `wenHonor` and `captureWenHonor`. Leader played 文尊. A later player plays 孖高腳, wins the trick, and collects 尊錢 as if they 賀尊. Remaining players 墊. 擒文尊 player leads next.

**賀四:** a player wins a 四文武 trick that is not the last trick of the hand. Base 4 instead of 2, same 莊 multiplier pattern. If a later player plays a higher 四文武, that later player is the 賀四 collector.

If that 四文武 or 至尊 trick is the last trick, it is 四大包 / 包尊, not 賀.

## Special 結

Apply after ordinary nets are computed. Multipliers apply to what the 結 player **wins** from players below par. They do not inflate 入一 / 入二 paid out by 結.

**包尊:** last trick is 至尊 (武尊, or unbeaten 文尊). x2.

**四大包:** last trick is 四文武. x4.

**么結:** last trick is singleton 三雞, or singleton 伶冧六 when `wenHonor`. x2.

**么雙擒四:** last trick is 大頭六 beating a led 三雞 么結, or 高腳七 beating a led 伶冧六 么結, and that player 結. The 么 player covers every below-par loser's loss (after 莊 multiplier on those losses), then that coverage is x4. 入一 / 入二 stay payable by the 結 player, not by the captured player, and are not x4.

If a 么 lead is beaten by a normal higher singleton that is not the capturing tile, or the capturing tile does not 結, it is ordinary play, not 擒.

## 七支 / 八支

Requires 結 with all 8 棟. Other three players have 0 棟.

**八支** if the last trick is any of:

- a currently unbeatable face-up singleton (明面最大: e.g. 天, or 地 after both 天 are out, or 九)
- the minimum singleton (三雞; 伶冧六 when `wenHonor`)
- a pair or larger combination

Otherwise the slam is **七支**.

If the 結 player already has 7 棟 and the others are ineligible to contest the last singleton, that last tile is forced and the slam is **七支**, even if the last tile is large.

**莊 八支 extra:** 莊's first lead of the hand must not be 天, 九, or 至尊 (武尊 / 文尊). Helic notes "不可頓牌" means this same restriction, not a second rule. If 莊 led 頂大, a slam cannot be 八支; it is 七支 if it still takes all 8 棟.

七支 x2. 八支 x4. These stack with 包尊 / 么結 / 四大包. Empty-hand base remains 5 before slam multipliers (七支 empty pays 10, 八支 empty pays 20, before 莊 multiplier).

## 例牌

Only if `examples` is on. Checked after deal, before first lead.

Helic set:

| Hand | Slam |
| --- | --- |
| 一點紅: exactly one red pip in the eight tiles | 七支 |
| 七武: exactly seven 武子 | 七支 |
| 全白: zero red pips | 八支 |
| 八武: eight 武子 | 八支 |

If several players qualify, 莊 wins the window. If 莊 does not qualify, the next eligible player counterclockwise from 莊 wins.

Winning 例牌 結 immediately with that slam multiplier. No tricks are played. 莊家倍數 still applies.

`extraExamples` adds 四對子 (four 寶子 and/or 雜子; 文武對 do not count), 七星文士 (seven 文子), 八方文士 (eight 文子). Those are 八支 for 四對子 and 八方文士, 七支 for 七星文士.

## CPU

CPU is a seated occupant. 1 human + 3 CPU is the local prototype. Online rooms fill remaining seats with CPU.

CPU must generate only legal moves for the locked Table, including 文尊 / 擒文尊 / 么結 / 例牌 when those options are on.

Minimum strength: never illegal; 賀尊 / 賀四 / 文尊 on lead when holding them; 擒文尊 when holding 孖高腳; attempt 結 when eligible; 墊 junk otherwise. Search is not required.

## Open decisions

- Exact first-莊 selection UI (dice vs random seat). Engine: seeded random seat.
- Whether a finished room keeps chips into Replay. Follow Connect Four: rematch resets chips to 100, keeps seats and Table.
- Disconnect grace. Follow existing room expiry; no extra 天九 rule.
