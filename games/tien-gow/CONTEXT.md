# 打天九

Four-player turn-based trick-taking with 32 Chinese dominoes in a `TGW` room.

## Language

**文子**:
Civil suit. Eleven named ranks, two identical tiles each.
_Avoid_: 華牌

**武子**:
Military suit. Ranked by pip total. Same total is equal rank.
_Avoid_: 夷牌

**棟**:
One captured tile. A trick of n tiles is n 棟.
_Avoid_: scoring by trick count

**墊牌**:
Face-down tiles of the required count, not beating the lead.
_Avoid_: discard, fold, pass, 頓牌

**結**:
Win the last eligible trick of the hand. That player is 莊 next.
_Avoid_: winning by most 棟

**莊**:
Banker. Leads the first trick. Payments that include 莊 use 莊家倍數.
_Avoid_: dealer, host

**Table**:
Optional rules locked before the first hand.
_Avoid_: house rule, settings
