# 小朋友落樓梯 · Downstairs

致敬經典 **NS-SHAFT** 的網頁版下樓梯遊戲。單人挑戰，或 2–4 人同機對戰。

## 玩法

- 只靠左右移動，在不斷上升的平台之間往下墜
- 從上方踩到新平台 +1 生命；釘板／天花尖刺 -5
- 輸送帶會把人帶走，彈簧會彈起，灰色翻轉台踩了會碎
- 多人可互推，也可踩在別人頭頂避刺
- 多人模式：最後還活著的人獲勝

| 玩家 | 鍵 |
|---|---|
| P1 黃帽 | ← → |
| P2 綠帽 | Z X（或 A D） |
| P3 紅帽 | V B |
| P4 紫帽 | `,` `.` |

難度：簡單／普通尖刺約 40%，困難約 75%。

## 本機執行

```bash
npm install
npm run dev
```

瀏覽器打開 `http://localhost:8080`。

```bash
npm run build
npm run preview
```

## 技術

TanStack Start + Vite + React + Canvas 2D。分數存在瀏覽器 `localStorage`，沒有資料庫。

致敬原作 [NS-SHAFT](https://en.wikipedia.org/wiki/Ns-Shaft)，本專案為非官方粉絲作品。
