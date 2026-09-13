export type SpriteSet = {
  idle: HTMLImageElement;
  walk: HTMLImageElement;
  fall: HTMLImageElement;
};

export type GameAssets = {
  p1: SpriteSet;
  p2: SpriteSet;
  p3: SpriteSet;
  p4: SpriteSet;
};

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed ${src}`));
    img.src = src;
  });
}

async function pack(who: "p1" | "p2"): Promise<SpriteSet> {
  const [idle, walk, fall] = await Promise.all([
    load(`/sprites/${who}/idle-sheet.png`),
    load(`/sprites/${who}/walk-sheet.png`),
    load(`/sprites/${who}/fall-sheet.png`),
  ]);
  return { idle, walk, fall };
}

export async function loadAssets(): Promise<GameAssets> {
  const [p1, p2] = await Promise.all([pack("p1"), pack("p2")]);
  return { p1, p2, p3: p1, p4: p1 };
}

export function spriteFor(assets: GameAssets | null, id: number): SpriteSet | null {
  if (!assets) return null;
  if (id === 1) return assets.p2;
  if (id === 2) return assets.p3;
  if (id === 3) return assets.p4;
  return assets.p1;
}
