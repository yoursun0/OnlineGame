# 打天九

Four-player turn-based trick-taking with one set of 32 Chinese dominoes, inside a PLAYROOM `TGW` room. Helic table is the rules source of truth.

## Language

**打天九**:
The PLAYROOM game. English slug `tien-gow`.
_Avoid_: Pai Gow, 推牌九, Tin Kau dice game, 小天九

**文子**:
The civil suit: eleven ranks, two identical tiles each, 22 tiles. Rank is by name, not pip count.
_Avoid_: 華牌, civilian card

**武子**:
The military suit: ten tiles ranked by pips. Same pip total is equal rank even if the faces differ.
_Avoid_: 夷牌, military card

**寶子**:
A civil pair. Two identical 文子.
_Avoid_: using 文對 as the spoken house name; keep 文對 in ranking tables

**雜子**:
A military pair of equal pip rank: 雜九, 雜八, 雜七, 雜五.
_Avoid_: using 武對 as the spoken house name; keep 武對 in ranking tables

**至尊 / 武尊**:
The pair 三雞 + 大頭六. Lead-only. Nothing beats it; it beats nothing.
_Avoid_: Gee Joon in player-facing copy

**文尊**:
The pair of 伶冧六, when that table option is on.
_Avoid_: treating 孖伶冧 as 文尊 when the option is off

**擒文尊**:
Beating led 文尊 with 孖高腳, when that table option is on.
_Avoid_: 擒尊 as a way to beat 武尊

**棟**:
One captured tile, stacked as a scoring unit. A trick of n tiles is n 棟.
_Avoid_: trick count as the scoring unit

**墊牌**:
Playing the required number of tiles face down, not beating the current combination.
_Avoid_: discard, fold, pass, 頓牌

**結**:
Winning the last trick of the hand, with eligibility. The 結 player becomes the next 莊.
_Avoid_: win the hand by most 棟

**莊**:
Banker for the current hand. Leads the first trick. Payments involving 莊 use 莊家倍數.
_Avoid_: dealer, host (host is the PLAYROOM room owner)

**飛莊**:
The 結 player is 莊 next hand.
_Avoid_: 輪莊

**賀尊**:
Leading 武尊, or 文尊 when enabled, mid-hand (not as 包尊) and collecting 尊錢 immediately.
_Avoid_: mixing 賀尊 with end-of-hand 結 settlement

**包尊**:
結 with 至尊. Double the 結 winnings. Does not also collect 賀尊.
_Avoid_: collecting 賀錢 and then doubling unless that option is on

**賀四 / 四大賀**:
Winning a 四文武 trick mid-hand and collecting 賀錢 immediately.

**四大包**:
結 with 四文武. Quadruple the 結 winnings.

**么結**:
結 with the lowest singleton (三雞; also 伶冧六 when 文尊 is on). Double the 結 winnings.

**么雙擒四**:
A 么結 attempt beaten and 結 by 大頭六 (vs 三雞) or 高腳七 (vs 伶冧六). The captured player covers losers' losses, then x4.

**七支 / 八支**:
Slam: 結 with all 8 棟. Scoring x2 / x4. See rules.md for which slam is which.
_Avoid_: 七支 as "7 棟"

**例牌**:
A dealt hand that wins the hand immediately without play, when that option is on.

**Table**:
The locked set of optional rules for the room, chosen before the first hand.
_Avoid_: house rule, variant, settings as the domain name
