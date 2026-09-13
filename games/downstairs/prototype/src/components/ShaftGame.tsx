import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { loadAssets, type GameAssets } from "@/game/assets";
import { GameAudio } from "@/game/audio";
import {
  DIFFICULTY_LABEL,
  MODE_LABEL,
  PLAYER_NAME,
  STAGE_H,
  STAGE_W,
  isVersus,
  playerCount,
  type Difficulty,
  type PlayMode,
} from "@/game/constants";
import { Engine, type TrapFlags } from "@/game/engine";
import { renderWorld } from "@/game/render";
import { loadSave, recordScore, writeSave, type SaveData } from "@/game/save";

type Phase = "boot" | "menu" | "how" | "playing" | "paused" | "over";

type BootSnap = {
  mode?: PlayMode;
  difficulty?: Difficulty;
  traps?: { conveyor?: number | boolean; spring?: number | boolean; fragile?: number | boolean };
  play?: number;
  how?: number;
};

function readBoot(): BootSnap | null {
  try {
    const raw = sessionStorage.getItem("shaft-boot");
    if (!raw) return null;
    return JSON.parse(raw) as BootSnap;
  } catch {
    return null;
  }
}

function writeBoot(s: BootSnap) {
  try {
    sessionStorage.setItem("shaft-boot", JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const MODES: PlayMode[] = ["solo", "vs2", "vs3", "vs4"];
const DIFFS: Difficulty[] = ["easy", "normal", "hard"];

const EMPTY_SAVE: SaveData = {
  version: 1,
  best: { easy: [], normal: [], hard: [] },
  muted: false,
  lastDifficulty: "normal",
};

export function ShaftGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef(new Engine());
  const audioRef = useRef(new GameAudio());
  const assetsRef = useRef<GameAssets | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [save, setSave] = useState<SaveData>(EMPTY_SAVE);
  const [mode, setMode] = useState<PlayMode>("solo");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [traps, setTraps] = useState<TrapFlags>({ conveyor: true, spring: true, fragile: true });
  const [hud, setHud] = useState({ lives: [12, 12, 12, 12], floors: [0, 0, 0, 0], depth: 0 });
  const [err, setErr] = useState<string | null>(null);
  const scoredRef = useRef(false);
  const prefetching = useRef(false);

  function prefetchAssets() {
    if (assetsRef.current || prefetching.current) return;
    prefetching.current = true;
    loadAssets()
      .then((a) => {
        assetsRef.current = a;
      })
      .catch(() => {})
      .finally(() => {
        prefetching.current = false;
      });
  }

  useEffect(() => {
    const boot = readBoot();
    const saved = loadSave();
    setSave(saved);
    const mode0: PlayMode = boot?.mode && MODES.includes(boot.mode) ? boot.mode : "solo";
    const diff0: Difficulty =
      boot?.difficulty && DIFFS.includes(boot.difficulty) ? boot.difficulty : saved.lastDifficulty;
    const traps0: TrapFlags = {
      conveyor: boot?.traps ? !!boot.traps.conveyor : true,
      spring: boot?.traps ? !!boot.traps.spring : true,
      fragile: boot?.traps ? !!boot.traps.fragile : true,
    };
    setMode(mode0);
    setDifficulty(diff0);
    if (boot?.traps) setTraps(traps0);
    (window as unknown as { __shaftHydrated: boolean }).__shaftHydrated = true;
    const startIfQueued = () => {
      const now = readBoot();
      if (now?.play) {
        writeBoot({ ...now, play: 0 });
        const m = now.mode && MODES.includes(now.mode) ? now.mode : mode0;
        const d = now.difficulty && DIFFS.includes(now.difficulty) ? now.difficulty : diff0;
        const t: TrapFlags = {
          conveyor: now.traps ? !!now.traps.conveyor : traps0.conveyor,
          spring: now.traps ? !!now.traps.spring : traps0.spring,
          fragile: now.traps ? !!now.traps.fragile : traps0.fragile,
        };
        setMode(m);
        setDifficulty(d);
        setTraps(t);
        launchWith(m, d, t);
      } else if (now?.how) {
        writeBoot({ ...now, how: 0 });
        setPhase("how");
      }
    };
    startIfQueued();
    window.addEventListener("shaft-play", startIfQueued);
    return () => window.removeEventListener("shaft-play", startIfQueued);
  }, []);

  useEffect(() => {
    const later = window.setTimeout(prefetchAssets, 1800);
    return () => window.clearTimeout(later);
  }, []);

  useEffect(() => {
    audioRef.current.setMuted(save.muted);
  }, [save.muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const hudEvery = { t: 0 };

    const loop = (now: number) => {
      const raw = Math.min(0.1, (now - last) / 1000);
      last = now;
      const engine = engineRef.current;
      if (phase === "playing") {
        acc += raw;
        while (acc >= 1 / 120) {
          engine.step(1 / 120);
          acc -= 1 / 120;
        }
        const ev = engine.consumeEvents();
        const audio = audioRef.current;
        if (ev.land) audio.land();
        if (ev.hurt) audio.hurt();
        if (ev.spring) audio.spring();
        if (ev.death) audio.death();
        audio.tick(raw);
        if (engine.over && !scoredRef.current) {
          scoredRef.current = true;
          const best = Math.max(...engine.players.map((p) => p.best));
          setSave((s) => recordScore(s, engine.difficulty, best));
          setPhase("over");
        }
        hudEvery.t += raw;
        if (hudEvery.t > 0.08) {
          hudEvery.t = 0;
          setHud({
            lives: [0, 1, 2, 3].map((i) => engine.players[i]?.life ?? 0),
            floors: [0, 1, 2, 3].map((i) => engine.players[i]?.best ?? 0),
            depth: engine.depth,
          });
        }
      }
      const assets = assetsRef.current;
      if (phase === "playing" || phase === "paused" || phase === "over") {
        renderWorld(ctx, engine, assets, now / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    const engine = engineRef.current;
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Space", "KeyV", "KeyB", "Comma", "Period"].includes(e.code)) e.preventDefault();
      engine.setKey(e.code, true);
      if (e.code === "Escape" || e.code === "KeyP") {
        setPhase((p) => {
          if (p === "playing") return "paused";
          if (p === "paused") return "playing";
          return p;
        });
      }
      if (e.code === "Space" && phase === "paused") setPhase("playing");
    };
    const onUp = (e: KeyboardEvent) => engine.setKey(e.code, false);
    const onBlur = () => engine.clearKeys();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [phase]);

  function launchWith(nextMode: PlayMode, nextDiff: Difficulty, nextTraps: TrapFlags) {
    prefetchAssets();
    audioRef.current.unlock();
    audioRef.current.setMuted(save.muted);
    scoredRef.current = false;
    engineRef.current.start({ mode: nextMode, difficulty: nextDiff, traps: nextTraps });
    setHud({ lives: [12, 12, 12, 12], floors: [0, 0, 0, 0], depth: 0 });
    setPhase("playing");
  }

  function launch() {
    launchWith(mode, difficulty, traps);
  }

  function begin() {
    launch();
  }

  function toggleMute() {
    const next = { ...save, muted: !save.muted };
    writeSave(next);
    setSave(next);
    audioRef.current.setMuted(next.muted);
  }

  const inRun = phase === "playing" || phase === "paused" || phase === "over";
  const scores = save.best[difficulty];

  return (
    <div
      className="relative flex min-h-dvh flex-col bg-bg text-fg"
      style={{
        background: "radial-gradient(ellipse at 50% 28%, #164a78 0%, #0a2748 42%, #051428 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#0a2748]/55" />

      <header className="relative z-20 flex items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <p className="font-mono text-xs tracking-[0.22em] text-muted">DOWNSHAFT</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">小朋友落樓梯</h1>
        </div>
        <IconBtn onPress={toggleMute} label={save.muted ? "開啟聲音" : "靜音"}>
          {save.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </IconBtn>
      </header>

      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-3 pb-8">
        {err ? <p className="mb-2 text-sm text-danger">{err}</p> : null}

        <div className="flex w-full max-w-[420px] flex-col items-center gap-3">
          {inRun && <HudBar mode={mode} hud={hud} difficulty={difficulty} paused={phase === "paused"} />}
          {phase === "menu" || phase === "how" ? (
            <div className="relative z-30 w-full rounded-lg border border-border bg-surface/80 px-4 py-5 text-center shadow-[0_20px_60px_rgba(4,24,48,0.55)] backdrop-blur-[2px]">
              {phase === "menu" ? (
                <Menu
                  mode={mode}
                  difficulty={difficulty}
                  traps={traps}
                  scores={scores}
                  onMode={setMode}
                  onDiff={setDifficulty}
                  onTrap={(k, v) => setTraps((t) => ({ ...t, [k]: v }))}
                  onPlay={begin}
                  onHow={() => setPhase("how")}
                />
              ) : (
                <HowTo onBack={() => setPhase("menu")} />
              )}
            </div>
          ) : (
            <div
              ref={wrapRef}
              className="relative z-10 overflow-hidden rounded-lg border border-border bg-surface shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
              style={{ width: "min(100%, 360px)", aspectRatio: `${STAGE_W} / ${STAGE_H}` }}
            >
              <canvas
                ref={canvasRef}
                width={STAGE_W}
                height={STAGE_H}
                className="pointer-events-none block h-full w-full"
                style={{ imageRendering: "pixelated" }}
              />

              {phase === "playing" && mode === "solo" && (
                <div className="absolute inset-0 z-10 grid grid-cols-2">
                  <button
                    type="button"
                    aria-label="向左"
                    className="h-full w-full touch-manipulation bg-transparent"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      engineRef.current.touch[0] = -1;
                    }}
                    onPointerUp={() => {
                      engineRef.current.touch[0] = 0;
                    }}
                    onPointerCancel={() => {
                      engineRef.current.touch[0] = 0;
                    }}
                  />
                  <button
                    type="button"
                    aria-label="向右"
                    className="h-full w-full touch-manipulation bg-transparent"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      engineRef.current.touch[0] = 1;
                    }}
                    onPointerUp={() => {
                      engineRef.current.touch[0] = 0;
                    }}
                    onPointerCancel={() => {
                      engineRef.current.touch[0] = 0;
                    }}
                  />
                </div>
              )}

              {phase === "over" && (
                <Cover>
                  <GameOver engine={engineRef.current} onRetry={begin} onMenu={() => setPhase("menu")} />
                </Cover>
              )}
            </div>
          )}

          {(phase === "playing" || phase === "paused") && (
            <>
              <Controls
                mode={mode}
                paused={phase === "paused"}
                onPause={() => setPhase((p) => (p === "paused" ? "playing" : "paused"))}
                onDir={(who, dir) => {
                  engineRef.current.touch[who] = dir;
                }}
              />
              {phase === "paused" && (
                <Ghost onPress={() => setPhase("menu")}>回主選單</Ghost>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function HudBar({
  mode,
  hud,
  difficulty,
  paused,
}: {
  mode: PlayMode;
  hud: { lives: number[]; floors: number[]; depth: number };
  difficulty: Difficulty;
  paused: boolean;
}) {
  const n = playerCount(mode);
  const colors = ["bg-p1", "bg-p2", "bg-p3", "bg-p4"];
  return (
    <div className="w-full rounded-md border border-border bg-surface/90 px-3 py-2">
      <div className="flex items-end justify-between gap-2">
        <LifeBlock label="P1" color={colors[0]!} life={hud.lives[0] ?? 0} floor={hud.floors[0] ?? 0} />
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-widest text-muted">{DIFFICULTY_LABEL[difficulty]}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums leading-none">{hud.depth}</p>
          <p className={`text-[11px] ${paused ? "font-semibold tracking-[0.2em] text-accent" : "text-subtle"}`}>
            {paused ? "暫停" : "層"}
          </p>
        </div>
        {n >= 2 ? (
          <LifeBlock label="P2" color={colors[1]!} life={hud.lives[1] ?? 0} floor={hud.floors[1] ?? 0} align="right" />
        ) : (
          <div className="w-[92px]" />
        )}
      </div>
      {n >= 3 && (
        <div className="mt-2 flex items-end justify-between gap-2">
          <LifeBlock label="P3" color={colors[2]!} life={hud.lives[2] ?? 0} floor={hud.floors[2] ?? 0} />
          {n >= 4 ? (
            <LifeBlock label="P4" color={colors[3]!} life={hud.lives[3] ?? 0} floor={hud.floors[3] ?? 0} align="right" />
          ) : (
            <div className="w-[92px]" />
          )}
        </div>
      )}
    </div>
  );
}

function LifeBlock({
  label,
  color,
  life,
  floor,
  align = "left",
}: {
  label: string;
  color: string;
  life: number;
  floor: number;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "w-[92px] text-right" : "w-[92px]"}>
      <p className="font-mono text-[10px] tracking-widest text-muted">
        {label} · {floor}層
      </p>
      <div className="mt-1 flex gap-[2px]">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-[1px] ${i < life ? color : "bg-surface-2"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Menu({
  mode,
  difficulty,
  traps,
  scores,
  onMode,
  onDiff,
  onTrap,
  onPlay,
  onHow,
}: {
  mode: PlayMode;
  difficulty: Difficulty;
  traps: TrapFlags;
  scores: { name: string; floor: number }[];
  onMode: (m: PlayMode) => void;
  onDiff: (d: Difficulty) => void;
  onTrap: (k: keyof TrapFlags, v: boolean) => void;
  onPlay: () => void;
  onHow: () => void;
}) {
  return (
    <>
      <p className="text-[11px] leading-snug tracking-[0.12em] text-muted">致敬經典 NS-SHAFT 小朋友落樓梯</p>
      <h2 className="mt-0.5 text-xl font-semibold">選關</h2>
      <div className="mt-3 grid w-full grid-cols-2 gap-2">
        {(["solo", "vs2", "vs3", "vs4"] as PlayMode[]).map((m) => (
          <Seg key={m} active={mode === m} data-pick={`mode:${m}`} onPress={() => onMode(m)}>
            {MODE_LABEL[m]}
          </Seg>
        ))}
      </div>
      <div className="mt-2 grid w-full grid-cols-3 gap-2">
        {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
          <Seg key={d} active={difficulty === d} data-pick={`diff:${d}`} onPress={() => onDiff(d)}>
            {DIFFICULTY_LABEL[d]}
          </Seg>
        ))}
      </div>
      <div className="mt-2 flex w-full flex-wrap justify-center gap-1.5 text-xs text-muted">
        <Toggle data-pick="trap:conveyor" on={traps.conveyor} onPress={() => onTrap("conveyor", !traps.conveyor)}>
          輸送帶
        </Toggle>
        <Toggle data-pick="trap:spring" on={traps.spring} onPress={() => onTrap("spring", !traps.spring)}>
          彈簧
        </Toggle>
        <Toggle data-pick="trap:fragile" on={traps.fragile} onPress={() => onTrap("fragile", !traps.fragile)}>
          翻轉台
        </Toggle>
      </div>
      <Primary className="mt-4" data-boot="play" onPress={onPlay}>
        {isVersus(mode) ? "開始對戰" : "開始下樓"}
      </Primary>
      <Ghost className="mt-2" data-boot="how" onPress={onHow}>
        玩法說明
      </Ghost>
      {scores.length > 0 && (
        <div className="mt-3 w-full border-t border-border pt-2">
          <p className="font-mono text-[10px] tracking-widest text-subtle">BEST 5 · {DIFFICULTY_LABEL[difficulty]}</p>
          <ol className="mt-1 space-y-0.5 font-mono text-sm tabular-nums text-muted">
            {scores.map((s, i) => (
              <li key={`${s.floor}-${s.name}-${i}`} className="flex justify-between">
                <span>{i + 1}</span>
                <span>{s.floor} 層</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold">玩法</h2>
      <ul className="mt-3 space-y-2 text-left text-sm leading-relaxed text-muted">
        <li>只靠左右移動，在不斷上升的地板之間往下墜。</li>
        <li>從上方踩到尚未踩過的新平台 +1 生命（滿血不加）。釘板或天花板尖刺 -5。</li>
        <li>生命歸零，或雙腳掉出畫面底部，遊戲結束。畫面外不會有平台接住你。</li>
        <li>P1 方向鍵　P2 Z / X（或 A / D）　P3 V / B　P4 , / .　多人可互推。</li>
        <li>可踩在別人頭頂上，踩住時會跟得很穩；對方站在釘板上，踩頭可避刺。</li>
        <li>多人模式最後還活著的人獲勝；若最後兩人同層死亡，較遲死的贏。</li>
        <li>綠黑輸送帶會把人帶走；綠色彈簧會彈起；灰色翻轉台踩了會碎裂消失。</li>
      </ul>
      <div className="mt-4 space-y-1.5 text-left text-sm leading-relaxed text-muted">
        <p className="font-medium text-fg">難度分別</p>
        <p><span className="text-accent">簡單</span>：平台升得較慢，尖刺約佔 40%。</p>
        <p><span className="text-accent">普通</span>：標準捲動速度，尖刺約佔 40%。</p>
        <p><span className="text-accent">困難</span>：升得更快，尖刺約佔 75%。</p>
      </div>
      <Ghost className="mt-5" onPress={onBack}>
        返回
      </Ghost>
    </>
  );
}

function GameOver({
  engine,
  onRetry,
  onMenu,
}: {
  engine: Engine;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const winnerName = engine.winner != null ? PLAYER_NAME[engine.winner] : null;
  return (
    <>
      <p className="font-mono text-[10px] tracking-widest text-muted">GAME OVER</p>
      <h2 className="mt-1 text-2xl font-semibold">墜到第 {engine.depth} 層</h2>
      {isVersus(engine.mode) && (
        <p className="mt-2 text-sm text-muted">
          {winnerName ? `${winnerName} 勝` : "平手"}
        </p>
      )}
      <div className="mt-5 flex w-full flex-col gap-2">
        <Primary onPress={onRetry}>
          <RotateCcw className="size-4" />
          再來一局
        </Primary>
        <Ghost onPress={onMenu}>主選單</Ghost>
      </div>
    </>
  );
}

function Controls({
  mode,
  paused,
  onPause,
  onDir,
}: {
  mode: PlayMode;
  paused: boolean;
  onPause: () => void;
  onDir: (who: number, dir: -1 | 0 | 1) => void;
}) {
  const n = playerCount(mode);
  return (
    <div className="relative z-30 flex w-full flex-col gap-2">
      <div className="flex w-full items-stretch gap-2">
        {n >= 2 ? (
          <Pad label="P2" color="text-p2" glyphs={["Z", "X"]} onDir={(d) => onDir(1, d)} />
        ) : (
          <div className="flex-1" />
        )}
        <IconBtn onPress={onPause} label={paused ? "繼續" : "暫停"} size="lg">
          {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </IconBtn>
        <Pad label="P1" color="text-p1" onDir={(d) => onDir(0, d)} />
      </div>
      {n >= 3 && (
        <div className="flex w-full items-stretch gap-2">
          <Pad label="P3" color="text-p3" glyphs={["V", "B"]} onDir={(d) => onDir(2, d)} />
          {n >= 4 ? (
            <Pad label="P4" color="text-p4" glyphs={[",", "."]} onDir={(d) => onDir(3, d)} />
          ) : (
            <div className="flex-1" />
          )}
        </div>
      )}
    </div>
  );
}

function Pad({
  label,
  color,
  onDir,
  glyphs,
}: {
  label: string;
  color: string;
  onDir: (d: -1 | 0 | 1) => void;
  glyphs?: [string, string];
}) {
  return (
    <div className="flex flex-1 gap-2">
      <HoldButton aria={`${label} 左`} onHold={() => onDir(-1)} onRelease={() => onDir(0)}>
        {glyphs ? <span className="font-mono text-base font-semibold">{glyphs[0]}</span> : <ArrowLeft className="size-5" />}
      </HoldButton>
      <HoldButton aria={`${label} 右`} onHold={() => onDir(1)} onRelease={() => onDir(0)}>
        {glyphs ? <span className="font-mono text-base font-semibold">{glyphs[1]}</span> : <ArrowRight className="size-5" />}
      </HoldButton>
      <span className={`sr-only ${color}`}>{label}</span>
    </div>
  );
}

function HoldButton({
  children,
  onHold,
  onRelease,
  aria,
}: {
  children: ReactNode;
  onHold: () => void;
  onRelease: () => void;
  aria: string;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      className="flex h-14 flex-1 items-center justify-center rounded-md border border-border bg-surface-2 text-fg active:bg-accent active:text-accent-fg"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        onHold();
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
    >
      {children}
    </button>
  );
}

function Cover({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-y-auto bg-bg/90 px-4 py-4 text-center">
      {children}
    </div>
  );
}

function Pressable({
  onPress,
  className,
  children,
  ...rest
}: {
  onPress: () => void;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onPointerUp">) {
  const lock = useRef(0);
  const fire = () => {
    const t = performance.now();
    if (t - lock.current < 420) return;
    lock.current = t;
    onPress();
  };
  return (
    <button
      type="button"
      className={className}
      onPointerUp={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        fire();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fire();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function Primary({
  children,
  onPress,
  className = "",
  ...rest
}: {
  children: ReactNode;
  onPress: () => void;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onPointerUp">) {
  return (
    <Pressable
      onPress={onPress}
      className={`inline-flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-fg ${className}`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

function Ghost({
  children,
  onPress,
  className = "",
  ...rest
}: {
  children: ReactNode;
  onPress: () => void;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onPointerUp">) {
  return (
    <Pressable
      onPress={onPress}
      className={`inline-flex h-12 min-h-12 w-full items-center justify-center rounded-md border border-border bg-transparent text-sm text-fg ${className}`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

function Seg({
  active,
  onPress,
  children,
  ...rest
}: {
  active: boolean;
  onPress: () => void;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onPointerUp">) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-12 min-h-12 rounded-sm text-sm ${
        active ? "bg-accent text-accent-fg" : "border border-border bg-surface-2 text-muted"
      }`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

function Toggle({
  on,
  onPress,
  children,
  ...rest
}: {
  on: boolean;
  onPress: () => void;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onPointerUp">) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-11 rounded-full px-3 py-2 ${on ? "bg-surface-2 text-fg" : "text-subtle line-through"}`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

function IconBtn({
  children,
  onPress,
  label,
  size = "md",
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  size?: "md" | "lg";
}) {
  return (
    <Pressable
      onPress={onPress}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg ${
        size === "lg" ? "size-14" : "size-11"
      }`}
    >
      {children}
    </Pressable>
  );
}
