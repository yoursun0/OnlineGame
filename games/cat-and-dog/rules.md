# Cat-and-Dog rules

This is the source of truth for PLAYROOM Cat-and-Dog / 貓狗大作戰.

The play is a turn-based remake of Fleabag vs. Mutt (gametuner.com, Copyright © 2000). That movie may not be placed on a web site without authorization. PLAYROOM ships new art and does not embed the projector, the SWF, or the original shapes and sounds. Evidence for the numbers below is the local note `docs/research/cat-and-dog-projector.md` on branch `research/cat-and-dog-projector`.

## Catalogue

- Slug `cat-and-dog`. Room prefix `CAD`. A room code looks like `CAD-7KQ`.
- Short description: Hold, release, and throw over the fence until the other side gives up.
- Estimated minutes: 8.
- Table strings are bilingual, English and 繁體中文, the same way the lobby is. This file stays English.
- Player-facing names are Cat and Dog. Cat is the movie's Fleabag. Dog is the movie's Mutt.

## Room

- Two seats. The second occupant may be another guest or a CPU.
- Seat 0 is Cat. Seat 1 is Dog. The animals are not shuffled.
- When a room starts, the occupants are placed at random into those seats. A solo CPU is shuffled the same way. There is no side picker.
- A host who is the only person in the room may start versus CPU without waiting for another guest. That human chooses the difficulty before the start.
- A two-guest start follows Connect Four: the room is full and both humans are ready. A two-guest room has no difficulty menu and uses full wind.
- Dog acts first in each round, then Cat, then Dog again. A rematch does not change who starts.

## Turn and move

The guest whose side is to act sends one move. The server rejects a move from any other guest.

A move is one of:

- A throw: an item and a released power `p`. `p` is an integer from 1 through 33. The item is `none`, `doubleAttack`, `powerThrow`, or `stinkBomb`.
- A power up: no power is sent. The turn ends without a throw.

The movie can leave more than one item flag set. v1 does not. One move carries one item. A plain throw uses `none`.

The client measures the hold. The server does not replay the charge frames. It rejects a power outside 1..33.

## Wind

Wind `z` is an integer drawn on the server when a side's turn begins, before the move is applied.

Full wind, used in every two-guest game and in solo level 1 and level 2, is one of these 14 values, each equally likely: 0, −7, −6, −5, −4, −3, −2, −1, 7, 6, 5, 4, 3, 2. The value 1 is not in this set.

Expert wind is used only when the solo human chose that difficulty. It is 0, 1, or −1, each equally likely.

The draw is a pure function of the room code and how many wind draws this game has already taken, so the same moves produce the same landings. A double attack does not draw a second wind. It reuses the turn's `z`.

## Distance

Cat and Dog face each other, so the same `z` is applied with opposite sign.

- Dog throws: `qq = p - z`.
- Cat throws: `qq = p + z`.

`qq` of 0 or less uses the first row of that side's table. `qq` of 32 or more uses the last row. A gap row does not change the defender's meter and uses reaction 1. The movie leaves the previous projectile on screen for a gap and has no script there. v1 treats that as a miss.

## Dog's landing

Dog throws at Cat. Adds go to Cat's give-up meter. The power-throw column applies only when the item is `powerThrow`. `stinkBomb` uses the normal add. Its only other effect is which projectile the client draws.

| `qq` | Result |
| --- | --- |
| 1–9 | miss, reaction `gh1` |
| 10 | gap, miss, reaction `gh1` |
| 11–17 | miss, reaction `gh1` |
| 18 | hit, reaction `gh2`, +2 |
| 19 | hit, reaction `gh2`, +3 |
| 20 | hit, reaction `gh3`, +5, or +9 on a power throw |
| 21 | hit, reaction `gh2`, +2, or +3 on a power throw |
| 22 | hit, reaction `gh4`, +3, or +4 on a power throw |
| 23–30 | miss, reaction `gh1` |
| 31 | gap, miss, reaction `gh1` |
| 32 or more | miss, reaction `gh1` |

## Cat's landing

Cat throws at Dog. Adds go to Dog's give-up meter.

| `qq` | Result |
| --- | --- |
| 1–13 | miss, reaction `ph1` |
| 14 | gap, miss, reaction `ph1` |
| 15–16 | miss, reaction `ph1` |
| 17 | hit, reaction `ph3`, +1, or +2 on a power throw |
| 18 | gap, miss, reaction `ph1` |
| 19 | hit, reaction `ph3`, +2, or +3 on a power throw |
| 20 | hit, reaction `ph2`, +6, or +9 on a power throw |
| 21 | hit, reaction `ph3`, +2, or +4 on a power throw |
| 22 | hit, reaction `ph4`, +2, or +3 on a power throw |
| 23–24 | miss, reaction `ph1` |
| 25 | gap, miss, reaction `ph1` |
| 26–30 | miss, reaction `ph1` |
| 31 | gap, miss, reaction `ph1` |
| 32 or more | miss, reaction `ph1` |

## Give-up meters

Each side has a give-up meter. It is not a score. Both start at frame 1.

A hit adds that row's amount to the defender's meter. A miss adds nothing. A power up subtracts 7 from the acting side's own meter. The server floors a meter at frame 1. The movie does not clamp a seek below frame 1. v1 does.

Frames 14 through 22 are a warning face. They do not change the rules.

When a defender's meter is frame 23 or higher after a throw, that side has given up and the turn ends. Dog's meter filled means Cat wins. Cat's meter filled means Dog wins. There is no draw.

## Items

- `none` uses the normal add.
- `powerThrow` uses the larger add in the table.
- `stinkBomb` uses the normal add.
- `doubleAttack` resolves the same `p` and the same `z` a second time. It does not change the add of either landing. If the first landing wins, the second landing is not applied.
- `powerUp` spends the turn, adds no hit, and subtracts 7 from the acting side's meter.

The CPU never chooses an item.

## CPU

The solo human chooses one difficulty before the room starts. The CPU uses it on whichever seat the shuffle gave it. After the human's turn, the server applies the CPU's turn immediately.

- Level 1: power 21, full wind.
- Level 2: power 22, full wind.
- Expert wind: power 20, expert wind.

The CPU throws at that fixed power. It does not charge and it does not power up.

## Win, rematch, and authority

- The playing heading names the seated guest whose side is to act.
- A win names the winning guest and side. The text is "Cat wins" or "Dog wins".
- The server applies wind, the landing, and both meters, then stores the result. Every browser renders that result. The host's browser does not simulate the throw.
- A rematch in the same room keeps the seats, the difficulty, and a CPU occupant. Meters return to frame 1. Dog acts first again.
- Any remaining member may request that rematch after the room is finished. The Replay control is available only while both seats are still occupied, as in Connect Four.

## Art

Ship art is new. The stage reference is 600×430. Cat stands on the left and Dog on the right, with a fence between them and the two meters along the top. Reaction poses are `gh1`–`gh4` for Cat and `ph1`–`ph4` for Dog. Pose 1 is the miss. The study frames, when they exist, live only in `.scratch/cat-and-dog/study/` and are not committed.

How close those poses and the camera cuts must match the movie is still open. See Open decisions.

## Open decisions

- Whether v1 plays new sound cues. It does not ship the movie's audio.
- Whether a disconnected player receives a grace period before the room is finished.
- Whether a guest may join a room that has already started.
- How close ship art must stay to the four reaction poses and the movie's camera cuts.
