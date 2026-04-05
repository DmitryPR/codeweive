/** localStorage snapshot for canvas + HUD (see `mount` in app.ts). */
export const PERSIST_KEY = "codeweive.v1";

export type PersistHudV1 = {
  mirror: boolean;
  rotations: number;
  spiral: boolean;
  heartbeat: boolean;
  ambientSound: boolean;
  autoDraw: boolean;
  autoDrawPreset: string;
  saveResolution: string;
  hudMenuOpen: boolean;
};

export type PersistBubbleV1 = {
  placed: boolean;
  left?: number;
  top?: number;
  panelOpen: boolean;
};

export type PersistColorsV1 = {
  base: string;
  accent: string;
};

export type PersistV1 = {
  v: 1;
  hud: PersistHudV1;
  bubble: PersistBubbleV1;
  colors: PersistColorsV1;
  cw: number;
  ch: number;
  silkPng: string;
  undoPngs: string[];
};

export function imageDataToPngUrl(data: ImageData): string {
  const c = document.createElement("canvas");
  c.width = data.width;
  c.height = data.height;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(data, 0, 0);
  return c.toDataURL("image/png");
}

export function parsePersisted(raw: string): PersistV1 | null {
  try {
    const o = JSON.parse(raw) as PersistV1;
    if (o?.v !== 1 || typeof o.silkPng !== "string") return null;
    if (typeof o.cw !== "number" || typeof o.ch !== "number") return null;
    if (!o.hud || !o.bubble || !o.colors) return null;
    return {
      ...o,
      undoPngs: Array.isArray(o.undoPngs) ? o.undoPngs : [],
    };
  } catch {
    return null;
  }
}

export function drawDataUrlToSilkCtx(
  url: string,
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(img, 0, 0, cw, ch);
      ctx.restore();
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export async function pngUrlsToImageDataStack(
  urls: string[],
  cw: number,
  ch: number,
): Promise<ImageData[]> {
  const out: ImageData[] = [];
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith("data:")) continue;
    const id = await dataUrlToImageData(url, cw, ch);
    if (id) out.push(id);
  }
  return out;
}

function dataUrlToImageData(
  url: string,
  targetW: number,
  targetH: number,
): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = targetW;
      c.height = targetH;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        resolve(ctx.getImageData(0, 0, targetW, targetH));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
