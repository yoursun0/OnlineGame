# Classic arcade rules for 小朋友落樓梯 (NS-SHAFT)

Question: What are the canonical arcade rules for 小朋友落樓梯 (falling-stairs / stair-drop browser games): lives or one-shot death, holes vs moving stairs, reaching the bottom vs survival score, collision, and any historical multiplayer?

This note is a first-party fallback for later grilling / [What counts as winning a shared well](../issues/04-shared-well-outcome.md). It does not invent house rules. Local PLAYROOM `games/little-stairs/rules.md` is a turn-based placeholder and is **not** arcade canon.

## Identity

HK **小朋友落樓梯** = TW **小朋友下樓梯** = CN **是男人就下100層** = JP **NS-SHAFT**, by Akihiko Kusanagi / NAGI-P SOFT.

Chinese Wikipedia records the regional names and a Macintosh release of November 1996. Its body also says “1990”; that date is internally inconsistent with the infobox and with contemporaneous magazine listings on the official Mac page. Wikipedia’s infobox lists **街機** with `[來源請求]` and mode **單人**. Treat Wikipedia as a name table only; do not treat NS-SHAFT as a verified arcade cabinet, and do not treat the infobox as proof that 2P never existed.

Sister game **NS-TOWER** is the going-*up* counterpart (蓄力跳躍 / climb). It is not this ruleset.

There is no English Wikipedia article.

## Source of truth

**First-party playtext (canon for rules):**

| Build | URL |
| --- | --- |
| Official JP Windows 1.3J | https://www.nagi-p.com/v1/nssh.html |
| Official JP Mac 1.3J (same playtext + changelog) | https://www.nagi-p.com/v1/nsshaft.html |
| Official EN Mac 1.2 | https://www.nagi-p.com/v1/eng/nsshaft.html |
| Official FR Mac 1.2F | https://www.nagi-p.com/v1/fre/nsshaft.html |
| Studio home / Java ports | https://www.nagi-p.com/v1/ |

Windows 1.3J and Mac 1.3J use the same Japanese how-to-play. English/French 1.2 describe the same 1P loop but predate the 1.3J two-player addition.

**Contemporaneous, not first-party:** Vector weekly software news, 1997-07-23, covering Mac 1.3J: https://www.vector.co.jp/magazine/softnews/970723/n707235.html

**Instrumented, not official docs:** Chang et al., *Sensors* 22(14):5265 (2022), on **NS-SHAFT 1.3J** via Cheat Engine: https://doi.org/10.3390/s22145265 — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9317465/

Later Flash/HTML5 clones, student remakes, GBA fusion, and Wikipedia gameplay paragraphs are a **separate lineage**. Cite them only to show what is *not* original.

## Play loop (first-party)

Left/right only. Descend a vertical shaft (`縦穴`). Avoid ceiling spikes closing from above.

Official JP (Win/Mac 1.3J):

> 上からせまるとげに刺さらないように、主人公を左右に動かして、縦穴を降りていってください。キーボードの左右の矢印キーを押すと移動します。

Official EN 1.2:

> Move the character with arrow keys and dive deeper into the cave.

Difficulty menu: Easy / Normal / Hard (`やさしい` / `ふつう` / `むずかしい`). Difficulty changes **floor spawn pattern and scroll speed**. Independently of that, the player can toggle conveyor / jump pad / rotating floor on or off.

## Lives vs one-shot death

**Canon: life gauge, not one-shot.**

Official JP 1.3J:

- The character has a fixed amount of vitality (`一定の生命力`), shown at the top of the screen.
- Game over if vitality reaches **0**.
- Game over if the player **misses a floor and falls to the bottom of the screen** (`床を踏み外し、画面の一番下まで落ちてしまうとゲームオーバー`).
- Vitality **decreases** when stabbed by ceiling spikes or spikes growing from a floor.
- Vitality **recovers** each time the player lands on a **normal** floor (`ふつうの床`).

Official EN 1.2: die if you “fall all the way to the bottom or run out of the ‘life.’” Life is displayed upper-left; it decreases on “pillards” (spikes) and recovers by landing on a normal floor.

Official FR 1.2F: same loop (`Force` / spikes / recover on a normal platform / fall off the bottom).

Official first-party text does **not** give a numeric HP total or per-hit values.

iOS (Akihiko Kusanagi, 2013; copy preserved at https://ns-shaft.appstor.io/): same life + fall-off-bottom loop. Life decreases on spikes; recover by landing on normal floors. Die if life runs out or if the character falls to the bottom.

**Measured on Win 1.3J, not official docs** (Chang et al. 2022, Cheat Engine): 12 HP; spike hit −5; normal land +1 if HP < 12; game ends on fall **or** HP 0. Three difficulties; scroll speed and spike ratio rise with floor; needle density jumps after about floor 80. Cite as instrumentation of 1.3J, not as designer documentation.

Some later Flash/mod clones drop HP for one-shot death. That is **not** original.

## Holes vs moving stairs

**Canon: moving platforms in a well, not a named “hole” floor type.**

Official setting is a vertical shaft. Vector 1997 describes it as a well-like shaft (`大きな井戸のようにまっすぐに掘られ`) starting underground at floor **0001**, with ordinary floors plus conveyor, jump pad, and rotating floors, and a ceiling of approaching spikes.

Official named floor/hazard types (JP 1.3J menus + changelog):

| Official name | Notes |
| --- | --- |
| ふつうの床 | Normal floor; landing recovers life |
| 上からせまるとげ | Ceiling spikes; damage |
| 床から生えているとげ | Floor spikes; damage |
| ベルトコンベア | Conveyor; independent on/off toggle |
| ジャンプ台 | Jump pad; independent on/off toggle |
| 回る床 | Rotating floor; added in **1.2J**; independent on/off toggle |

Gaps between platforms exist: missing a floor (`踏み外し`) and falling off the bottom of the screen is instant game over. Official text does **not** name “holes,” “disappearing floors,” or “flip floors” as a type. The official named moving-floor type is **rotating** (`回る床`), not “holes.”

Clone folklore (Chinese Flash / Baidu / Wikipedia gameplay copy) often lists five colours including a one-step flip/disappear floor. That is the **Flash remake lineage**, not NAGI-P’s how-to-play.

## Reaching the bottom vs survival score

**Canon: score = floors descended. No official finish line.**

- Rank is “how far down you got” (`降りた階`). Top **5** names on desktop 1.3J.
- Vector 1997: start at underground **0001**; compete to reach a lower floor.
- Official text never describes clearing 100 floors, reaching a bottom, or an ending.
- 2P mode: even a top-5 floor count **cannot** register a name.

“100層” is the Chinese Flash slogan (`是男人就下100層`), not the original win condition. TechOrange (2021), reporting Bilibili uploader 假期贩子 plus author contact: Flash copies are unauthorized remakes; the original Windows download still runs past 100 with no ending; trilingual official sites have no 100-floor plot. An MSX magazine “8192-floor tower” listing is a **different / unpublished** piece, not NS-SHAFT’s ending.

iOS: top **10** local names plus optional world ranking upload. Still a depth score, not a clear.

NS-SHAFT 2 (2007 Java, studio home): 1P plus **national ranking** over the network. Still ranking by descent, not a 100-floor clear.

## Collision

**Documented in first-party text:**

- Ceiling spikes: damage (life down).
- Floor spikes: damage (life down).
- Miss platform / fall to the bottom of the screen: **instant** game over (not a life tick).
- Being carried upward into the ceiling is the slow-death path implied by “don’t get stabbed by the approaching spikes.”
- Left/right is the only control. Air left/right is implied by falling between platforms, but official text does not spell out air-control vs on-platform control separately.

**Undocumented in first-party text (do not invent):**

- Wall wrap vs clamp.
- Exact hitboxes, invulnerability frames, or whether spike damage repeats while standing on a spike floor.
- Numeric HP / −5 / +1 (measured later; not in the how-to-play).
- Player-body vs player-body push, squeeze, or stomp.

Later play accounts (e.g. iqmore.tw, 2023) claim two players can squeeze the other off a platform. Mark as **undocumented play observation**, not a house rule and not first-party.

## Historical multiplayer

**2P is historical and first-party.** Added in **Mac 1.3J** (changelog: `ver1.2J → ver1.3J` · `２人プレイモードを追加しました`). Vector 1997: Windows 1.2J **lacked** 2P at that date; Mac 1.3J had it.

Official 1.3J “２人プレイについて”:

- File menu **「２人プレイ」**.
- P1 yellow, left/right arrows.
- P2 green, **Z / X**.
- Same shaft: play continues while **either** player is alive (`どちらかが生きている限り縦穴を降りていくことができます`).
- 2P scores are **not** recorded in the top 5.

Official text does **not** document body-vs-body push, shared vs separate life gauges beyond the continue-while-either-lives rule, or networked 2P.

Later official ports:

- **NS-SHAFT 2** (2007 au/EZ Java, studio home): 1P + nationwide ranking. Not local 2P.
- **iOS 1.1** (2013, archived studio news https://web.archive.org/web/20131228214334/http://www.nagi-p.com/en/news/21-ns-shaft-ios-1-1-released.html): “Sit around the screen with your friends and family” is **device-sharing / sofa**, not documented 2P controls. App copy is 1P life + fall + top 10 / world ranking.

Chinese Flash remakes are usually 1P. Later HTML5 imitations (e.g. https://github.com/iPel/NS-SHAFT) and student dual-mode remakes are not first-party.

## What is not canonical

Do **not** treat these as arcade canon for PLAYROOM:

- Local `games/little-stairs/rules.md` / turn-based placeholder.
- Wikipedia −5/+1, five floor types, 街機, 1990 body date, 單人 infobox (gameplay section has empty 參考資料).
- Chinese Flash “100層” slogan, flip/disappear floors, or one-shot mods.
- GBA fusion of SHAFT+TOWER with items/story (licensed derivative; not the shareware loop).
- Networked dual-mode student remakes, itch.io ASCII demakes.
- MSX magazine 8192-floor listing (unpublished / different work).
- Any invented wrap, push, stomp, or finish-line rule.

## Facts useful to PLAYROOM (not design choices)

These are observations from the sources above, not a spec:

- The original loop is a **life gauge** plus **instant death on falling off the bottom**.
- The arena is a **shared vertical well** of moving platforms and spikes, not a board of holes.
- Score is **floor count**; there is **no official bottom / 100-floor clear**.
- **Local same-well 2P** exists from 1.3J; the well continues while **either** player lives; 2P names are not recorded.
- Player-player push is **undocumented**.
- Numeric HP (12 / −5 / +1) is **measured**, not printed in official playtext.

## Sources

1. NAGI-P SOFT, NS-SHAFT 1.3J for Windows — how to play, difficulty, 2P, options: https://www.nagi-p.com/v1/nssh.html
2. NAGI-P SOFT, NS-SHAFT 1.3J for Macintosh — same playtext, changelog (2P in 1.3J; 回る床 in 1.2J): https://www.nagi-p.com/v1/nsshaft.html
3. NAGI-P SOFT, NS-SHAFT 1.2 English: https://www.nagi-p.com/v1/eng/nsshaft.html
4. NAGI-P SOFT, NS-SHAFT 1.2F French: https://www.nagi-p.com/v1/fre/nsshaft.html
5. NAGI-P SOFT home (Win/Mac 1.3J listed; NS-SHAFT 2 Java 2007-02-12, 1P + 全国ランキング): https://www.nagi-p.com/v1/
6. Vector, 週刊ソフトニュース 97.07.23 — Mac 1.3J review; floor 0001; well; floor types; 2P; Win 1.2J without 2P: https://www.vector.co.jp/magazine/softnews/970723/n707235.html
7. Chang, Chen, Lin, Chang, “Application of Deep Reinforcement Learning to NS-SHAFT Game Signal Control,” *Sensors* 22(14):5265 (2022). Measured 1.3J HP/scroll/needles via Cheat Engine. DOI: https://doi.org/10.3390/s22145265 — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9317465/ (cites official 1.3J page as ref. 17)
8. iOS App Store copy (Akihiko Kusanagi): https://ns-shaft.appstor.io/
9. NAGI-P SOFT, “NS-SHAFT for iOS version 1.1 released” (2013-10, archived): https://web.archive.org/web/20131228214334/http://www.nagi-p.com/en/news/21-ns-shaft-ios-1-1-released.html
10. Chinese Wikipedia, *NS-SHAFT* — names only; 街機 `[來源請求]`; 單人 infobox omits official 2P; gameplay refs empty: https://zh.wikipedia.org/zh-hant/NS-SHAFT
11. TechOrange, 2021-01-29 — Flash slogan vs original endless descent; author contact via 假期贩子 / 量子位: https://techorange.com/2021/01/29/nagi-p-soft-shaft/
12. iqmore.tw, 2023-01-25 — play account of 2P squeeze; **not** first-party rules: https://iqmore.tw/ns-shaft-app-and-web-game
