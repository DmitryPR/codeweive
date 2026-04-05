import { createAmbientSound } from "./ambient-sound";
import { analyzeSilkImageData, centroidSemitoneFromWeights } from "./color-music";
import { plateCouplingFromImageData } from "./plate-coupling";
import type { StandingWaveParams } from "./standing-waves";
import { CanvasUtil } from "./canvas-util";
import { SILK_COLOR_PRESETS } from "./silk-colors";
import { Silk, type ScaleInfo, type SilkStatePartial } from "./silk";
import { Sparks } from "./sparks";

const AUTO_DRAW_PRESETS = ["lissajous", "orbit", "drift", "pulse"] as const;
type AutoDrawPreset = (typeof AUTO_DRAW_PRESETS)[number];

function parseAutoDrawPreset(v: string): AutoDrawPreset {
  for (const p of AUTO_DRAW_PRESETS) {
    if (p === v) return p;
  }
  return "lissajous";
}

function clampDrawXY(
  x: number,
  y: number,
  w: number,
  h: number,
  pad: number,
): { x: number; y: number } {
  return {
    x: Math.min(w - pad, Math.max(pad, x)),
    y: Math.min(h - pad, Math.max(pad, y)),
  };
}

/** Parametric paths for Auto-draw (`docs/FEATURE.md`). */
function autoDrawPosition(
  preset: AutoDrawPreset,
  t: number,
  w: number,
  h: number,
  pad: number,
): { x: number; y: number } {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = Math.min(w, h) * 0.19;
  let x: number;
  let y: number;
  switch (preset) {
    case "lissajous":
      x = cx + r * (Math.sin(t) + 0.32 * Math.sin(t * 2.17));
      y = cy + r * (Math.cos(t * 0.83) + 0.28 * Math.sin(t * 1.91));
      break;
    case "orbit":
      x = cx + r * Math.cos(t * 0.95);
      y = cy + r * Math.sin(t * 0.95);
      break;
    case "drift":
      x = cx + r * 0.85 * Math.sin(t * 0.31) + r * 0.35 * Math.sin(t * 0.73 + 1.2);
      y = cy + r * 0.85 * Math.cos(t * 0.27) + r * 0.32 * Math.cos(t * 0.91 + 0.4);
      break;
    case "pulse": {
      const breathe = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.55));
      const rr = r * breathe;
      x = cx + rr * Math.cos(t * 1.1) * (0.85 + 0.15 * Math.sin(t * 3));
      y = cy + rr * Math.sin(t * 1.1) * (0.85 + 0.15 * Math.cos(t * 2.7));
      break;
    }
  }
  return clampDrawXY(x, y, w, h, pad);
}

function deepSilkSettings(base: SilkStatePartial): SilkStatePartial {
  return structuredClone(base) as SilkStatePartial;
}

export function mount(root: HTMLElement): () => void {
  const silkStage = root.querySelector<HTMLElement>("#silk-stage")!;
  const silkCanvas = root.querySelector<HTMLCanvasElement>("#silk")!;
  const sparksCanvas = document.createElement("canvas");
  sparksCanvas.id = "sparks";
  sparksCanvas.setAttribute("aria-hidden", "true");
  silkStage.appendChild(sparksCanvas);

  const silkUtil = new CanvasUtil(silkCanvas);
  const sparksUtil = new CanvasUtil(sparksCanvas);

  const resize = (): void => {
    silkUtil.resizeToWindow();
    sparksUtil.resizeCanvas(silkUtil.widthOnScreen, silkUtil.heightOnScreen);
    silkUtil.fillSolid("#000");
    const sctx = sparksCanvas.getContext("2d");
    if (sctx) {
      sctx.save();
      sctx.globalCompositeOperation = "source-over";
      sctx.globalAlpha = 1;
      sctx.clearRect(0, 0, sparksUtil.widthOnScreen, sparksUtil.heightOnScreen);
      sctx.restore();
    }
  };

  resize();
  window.addEventListener("resize", resize);

  const silkCtx = silkCanvas.getContext("2d");
  if (!silkCtx) throw new Error("silk 2d");
  const sparks = new Sparks(sparksCanvas);
  const ambient = createAmbientSound();

  const defaultPalette = SILK_COLOR_PRESETS[0]!;
  let silkSettings: SilkStatePartial = {
    symNumRotations: 1,
    symMirror: true,
    spiralCopies: 1,
    color: defaultPalette.base,
    highlightColor: defaultPalette.accent,
  };

  const mirrorEl = root.querySelector<HTMLInputElement>("#mirror")!;
  const rotationsEl = root.querySelector<HTMLInputElement>("#rotations")!;
  const rotationsValueEl = root.querySelector<HTMLElement>("#rotations-value")!;
  const spiralEl = root.querySelector<HTMLInputElement>("#spiral")!;
  const heartbeatEl = root.querySelector<HTMLInputElement>("#heartbeat")!;
  const ambientSoundEl = root.querySelector<HTMLInputElement>("#ambient-sound")!;
  const autoDrawEl = root.querySelector<HTMLInputElement>("#auto-draw")!;
  const autoDrawPresetEl = root.querySelector<HTMLSelectElement>("#auto-draw-preset")!;
  const clearEl = root.querySelector<HTMLButtonElement>("#clear")!;
  const savePngEl = root.querySelector<HTMLButtonElement>("#save-png")!;
  const saveResolutionEl = root.querySelector<HTMLSelectElement>("#save-resolution")!;
  const colorBubble = root.querySelector<HTMLElement>("#color-bubble")!;
  const colorToggle = root.querySelector<HTMLButtonElement>("#color-bubble-toggle")!;
  const colorPanel = root.querySelector<HTMLElement>("#color-bubble-panel")!;
  const colorGrab = colorPanel.querySelector<HTMLElement>(".color-bubble-grab")!;
  const colorRing = root.querySelector<HTMLElement>("#color-swatch-ring")!;

  function readHudIntoSettings(): void {
    silkSettings.symMirror = mirrorEl.checked;
    const n = Math.max(
      1,
      Math.min(12, Math.floor(Number(rotationsEl.value) || 1)),
    );
    silkSettings.symNumRotations = n;
    rotationsEl.value = String(n);
    rotationsEl.setAttribute("aria-valuenow", String(n));
    rotationsValueEl.textContent = String(n);
    silkSettings.spiralCopies = spiralEl.checked ? 30 : 1;
  }

  mirrorEl.addEventListener("change", readHudIntoSettings);
  rotationsEl.addEventListener("input", readHudIntoSettings);
  rotationsEl.addEventListener("change", readHudIntoSettings);
  spiralEl.addEventListener("change", readHudIntoSettings);

  function scaleInfo(): ScaleInfo {
    return {
      logicalWidth: silkUtil.widthOnScreen,
      logicalHeight: silkUtil.heightOnScreen,
    };
  }

  function silkStartState(): SilkStatePartial {
    const state = deepSilkSettings(silkSettings);
    state.symCenterX = silkUtil.halfWidthOnScreen;
    state.symCenterY = silkUtil.halfHeightOnScreen;
    return state;
  }

  const strokes: Silk[] = [];
  let currentStroke: Silk | null = null;
  let inputX = 0;
  let inputY = 0;
  let pinputX: number | null = null;
  let pinputY: number | null = null;
  let inputIsActive = false;
  /** True while the user holds the pointer on the canvas (Auto-draw yields). */
  let userPointerHeld = false;
  let heartbeatPhase = 0;
  let autoDrawPhase = 0;

  function logicalFromEvent(clientX: number, clientY: number): { x: number; y: number } {
    const r = silkCanvas.getBoundingClientRect();
    const rw = r.width || 1;
    const rh = r.height || 1;
    const x = ((clientX - r.left) / rw) * silkUtil.widthOnScreen;
    const y = ((clientY - r.top) / rh) * silkUtil.heightOnScreen;
    return { x, y };
  }

  function inputFrame(): void {
    if (
      pinputX != null &&
      pinputY != null &&
      currentStroke &&
      inputIsActive
    ) {
      const ad = ambient.isEnabled() ? ambient.getDriveState() : null;
      const sx = ad
        ? Math.min(3.2, Math.max(-3.2, soundDitherX * 0.34))
        : 0;
      const sy = ad
        ? Math.min(3.2, Math.max(-3.2, soundDitherY * 0.34))
        : 0;
      currentStroke.addPoint(
        inputX + sx,
        inputY + sy,
        inputX - pinputX,
        inputY - pinputY,
      );
    }
    pinputX = inputX;
    pinputY = inputY;
  }

  function startStroke(): void {
    readHudIntoSettings();
    if (currentStroke) {
      currentStroke.complete();
    }
    const s = silkStartState();
    currentStroke = new Silk(silkCtx, scaleInfo(), s);
    currentStroke.setSparks(sparks);
    strokes.push(currentStroke);
    inputIsActive = true;
    pinputX = inputX;
    pinputY = inputY;
  }

  function endStroke(): void {
    if (currentStroke) {
      currentStroke.complete();
    }
    inputIsActive = false;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button === 2) return;
    userPointerHeld = true;
    silkCanvas.setPointerCapture(e.pointerId);
    const { x, y } = logicalFromEvent(e.clientX, e.clientY);
    inputX = x;
    inputY = y;
    startStroke();
  }

  function onPointerMove(e: PointerEvent): void {
    const { x, y } = logicalFromEvent(e.clientX, e.clientY);
    inputX = x;
    inputY = y;
  }

  function onPointerUp(e: PointerEvent): void {
    try {
      silkCanvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    userPointerHeld = false;
    const { x, y } = logicalFromEvent(e.clientX, e.clientY);
    inputX = x;
    inputY = y;
    endStroke();
  }

  function onLostPointerCapture(): void {
    if (!userPointerHeld) return;
    userPointerHeld = false;
    endStroke();
  }

  silkCanvas.addEventListener("pointerdown", onPointerDown);
  silkCanvas.addEventListener("pointermove", onPointerMove);
  silkCanvas.addEventListener("pointerup", onPointerUp);
  silkCanvas.addEventListener("pointercancel", onPointerUp);
  silkCanvas.addEventListener("lostpointercapture", onLostPointerCapture);

  clearEl.addEventListener("click", () => {
    silkUtil.fillSolid("#000");
    sparks.points.length = 0;
    strokes.length = 0;
    currentStroke = null;
    inputIsActive = false;
    pinputX = null;
    pinputY = null;
    lastSilkLuma = 0.02;
    lastPlateMeanF = 0;
    lastPlateRms = 0;
    lastPlateCoverage = 0;
    soundDitherX = 0;
    soundDitherY = 0;
  });

  function updateAutoDrawPresetDisabled(): void {
    autoDrawPresetEl.disabled = !autoDrawEl.checked;
  }

  function onAutoDrawPresetChange(): void {
    autoDrawPhase = 0;
  }

  function onAutoDrawChange(): void {
    updateAutoDrawPresetDisabled();
    if (!autoDrawEl.checked) {
      endStroke();
    }
  }
  autoDrawEl.addEventListener("change", onAutoDrawChange);
  autoDrawPresetEl.addEventListener("change", onAutoDrawPresetChange);
  updateAutoDrawPresetDisabled();

  async function onAmbientSoundChange(): Promise<void> {
    await ambient.setEnabled(ambientSoundEl.checked);
  }
  ambientSoundEl.addEventListener("change", onAmbientSoundChange);

  function onAmbientVisibility(): void {
    if (document.visibilityState === "visible") {
      ambient.resumeIfNeeded();
    }
  }
  document.addEventListener("visibilitychange", onAmbientVisibility);

  /** Lub–dub style envelope in [0, 1] for a ~1 rad step (tuned in applyHeartbeatVisual). */
  function heartbeatStrength(t: number): number {
    const lub = Math.max(0, Math.sin(t)) ** 2.15;
    const dub = Math.max(0, Math.sin(2 * t + 1.05)) ** 3.1 * 0.52;
    return Math.min(1, lub + dub);
  }

  function applyHeartbeatVisual(): void {
    if (!heartbeatEl.checked) {
      silkStage.style.transform = "";
      silkCanvas.style.filter = "";
      sparksCanvas.style.filter = "";
      return;
    }
    heartbeatPhase += 0.11;
    const n = heartbeatStrength(heartbeatPhase);
    const scale = 1 + 0.015 * n;
    const brightness = 1 + 0.065 * n;
    const contrast = 1 + 0.048 * n;
    silkStage.style.transform = `scale(${scale})`;
    const f = `brightness(${brightness}) contrast(${contrast})`;
    silkCanvas.style.filter = f;
    sparksCanvas.style.filter = f;
  }

  /** Keep the in-progress auto-draw stroke aligned with HUD + palette (slider, toggles, colors). */
  function syncAutoDrawStrokeWithHud(): void {
    if (!autoDrawEl.checked || userPointerHeld || !currentStroke || !inputIsActive) {
      return;
    }
    readHudIntoSettings();
    const s = currentStroke;
    s.symMirror = Boolean(silkSettings.symMirror);
    s.symNumRotations = silkSettings.symNumRotations ?? 1;
    s.spiralCopies = silkSettings.spiralCopies ?? 1;
    s.color = silkSettings.color ?? defaultPalette.base;
    s.highlightColor = silkSettings.highlightColor ?? defaultPalette.accent;
    s.symCenterX = silkUtil.halfWidthOnScreen;
    s.symCenterY = silkUtil.halfHeightOnScreen;
    s.cx = s.symCenterX;
    s.cy = s.symCenterY;
    s.twoCx = 2 * s.cx;
    s.twoCy = 2 * s.cy;
    s.initColors();
    s.generateDrawInstructions();
  }

  /** Synthetic paths when Auto-draw is on (`docs/FEATURE.md`). */
  function stepAutoDrawInput(): void {
    if (!autoDrawEl.checked || userPointerHeld) return;
    syncAutoDrawStrokeWithHud();
    const w = silkUtil.widthOnScreen;
    const h = silkUtil.heightOnScreen;
    if (w < 24 || h < 24) return;

    autoDrawPhase += 0.024;
    const preset = parseAutoDrawPreset(autoDrawPresetEl.value);
    const pad = 6;
    const p = autoDrawPosition(preset, autoDrawPhase, w, h, pad);
    inputX = p.x;
    inputY = p.y;

    if (!inputIsActive) {
      startStroke();
    }
  }

  const EXPORT_HD_W = 1920;
  const EXPORT_HD_H = 1080;
  const EXPORT_4K_W = 3840;
  const EXPORT_4K_H = 2160;

  function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      "image/png",
      1,
    );
  }

  /**
   * Composite silk + sparks into a canvas. Native = backing-store pixels 1:1.
   * HD / 4K = fixed output size, uniform scale, letterboxed on black (16:9 frame).
   */
  function buildExportCanvas(mode: string): HTMLCanvasElement | null {
    const sw = silkCanvas.width;
    const sh = silkCanvas.height;
    if (sw === 0 || sh === 0) return null;

    const out = document.createElement("canvas");
    let outW: number;
    let outH: number;
    let dx = 0;
    let dy = 0;
    let dw = sw;
    let dh = sh;

    if (mode === "hd") {
      outW = EXPORT_HD_W;
      outH = EXPORT_HD_H;
    } else if (mode === "4k") {
      outW = EXPORT_4K_W;
      outH = EXPORT_4K_H;
    } else {
      outW = sw;
      outH = sh;
    }

    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d");
    if (!octx) return null;

    if (mode === "hd" || mode === "4k") {
      octx.fillStyle = "#000000";
      octx.fillRect(0, 0, outW, outH);
      const scale = Math.min(outW / sw, outH / sh);
      dw = Math.max(1, Math.round(sw * scale));
      dh = Math.max(1, Math.round(sh * scale));
      dx = Math.floor((outW - dw) / 2);
      dy = Math.floor((outH - dh) / 2);
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
    }

    octx.drawImage(silkCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
    octx.drawImage(
      sparksCanvas,
      0,
      0,
      sparksCanvas.width,
      sparksCanvas.height,
      dx,
      dy,
      dw,
      dh,
    );
    return out;
  }

  function savePng(): void {
    const mode = saveResolutionEl.value;
    const out = buildExportCanvas(mode);
    if (!out) return;
    const tag =
      mode === "hd" ? "hd1080" : mode === "4k" ? "4k2160" : "native";
    downloadCanvasPng(out, `silk-port-${tag}-${Date.now()}.png`);
  }

  savePngEl.addEventListener("click", savePng);

  function fabGradient(): string {
    const c = silkSettings.color ?? defaultPalette.base;
    const h = silkSettings.highlightColor ?? defaultPalette.accent;
    return `linear-gradient(135deg, ${c}, ${h})`;
  }

  function updateColorFab(): void {
    colorToggle.style.background = fabGradient();
  }

  function applySilkColors(base: string, accent: string): void {
    silkSettings.color = base;
    silkSettings.highlightColor = accent;
    updateColorFab();
  }

  /** ~natural height of open palette + gap (swatch ring + padding + hint + grip) */
  const PANEL_PLACEMENT_MIN_SPACE = 210;
  const VIEW_PAD = 8;

  function updateBubblePanelPlacement(): void {
    const toggleR = colorToggle.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - toggleR.bottom - VIEW_PAD;
    const spaceAbove = toggleR.top - VIEW_PAD;
    const openAbove =
      spaceBelow < PANEL_PLACEMENT_MIN_SPACE && spaceAbove >= spaceBelow;

    const anchorMidX = toggleR.left + toggleR.width / 2;
    const alignEnd = anchorMidX > vw * 0.5;

    colorBubble.classList.toggle("color-bubble--panel-above", openAbove);
    colorBubble.classList.toggle("color-bubble--align-end", alignEnd);
  }

  /** Toggle + panel union (panel is absolutely positioned; bubble box is toggle-sized). */
  function bubbleUnionViewportRect(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const t = colorToggle.getBoundingClientRect();
    if (colorPanel.hidden) {
      return {
        left: t.left,
        top: t.top,
        right: t.right,
        bottom: t.bottom,
      };
    }
    const p = colorPanel.getBoundingClientRect();
    return {
      left: Math.min(t.left, p.left),
      top: Math.min(t.top, p.top),
      right: Math.max(t.right, p.right),
      bottom: Math.max(t.bottom, p.bottom),
    };
  }

  /** Nudge placed bubble anchor so toggle+panel stay in viewport. Returns true if moved. */
  function nudgePlacedBubbleForViewport(): boolean {
    if (!colorBubble.classList.contains("color-bubble--placed")) return false;
    const leftParsed = parseFloat(colorBubble.style.left);
    const topParsed = parseFloat(colorBubble.style.top);
    if (Number.isNaN(leftParsed) || Number.isNaN(topParsed)) return false;

    const iw = window.innerWidth;
    const ih = window.innerHeight;
    const r = bubbleUnionViewportRect();
    let dx = 0;
    let dy = 0;
    if (r.right > iw - VIEW_PAD) {
      dx -= r.right - (iw - VIEW_PAD);
    }
    if (r.left + dx < VIEW_PAD) {
      dx = VIEW_PAD - r.left;
    }
    if (r.bottom > ih - VIEW_PAD) {
      dy -= r.bottom - (ih - VIEW_PAD);
    }
    if (r.top + dy < VIEW_PAD) {
      dy = VIEW_PAD - r.top;
    }
    if (dx !== 0 || dy !== 0) {
      colorBubble.style.left = `${Math.round(leftParsed + dx)}px`;
      colorBubble.style.top = `${Math.round(topParsed + dy)}px`;
      return true;
    }
    return false;
  }

  /** After layout change (e.g. panel opens), nudge fixed left/top so nothing clips */
  function ensureBubbleInViewport(): void {
    for (let i = 0; i < 6; i++) {
      if (!nudgePlacedBubbleForViewport()) break;
    }
  }

  function setColorPanelOpen(open: boolean): void {
    colorPanel.hidden = !open;
    colorToggle.setAttribute("aria-expanded", open ? "true" : "false");
    colorBubble.classList.toggle("color-bubble--open", open);
    updateBubblePanelPlacement();
    if (open) {
      requestAnimationFrame(() => {
        ensureBubbleInViewport();
      });
    }
  }

  type BubbleDragOrigin = "toggle" | "grab";

  type BubbleDragState = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
    origin: BubbleDragOrigin;
  };

  let bubbleDrag: BubbleDragState | null = null;

  function applyBubblePosition(left: number, top: number): void {
    const pad = 8;
    const w = colorBubble.offsetWidth;
    const h = colorBubble.offsetHeight;
    const maxL = Math.max(pad, window.innerWidth - w - pad);
    const maxT = Math.max(pad, window.innerHeight - h - pad);
    const l = Math.round(Math.min(maxL, Math.max(pad, left)));
    const t = Math.round(Math.min(maxT, Math.max(pad, top)));
    colorBubble.style.left = `${l}px`;
    colorBubble.style.top = `${t}px`;
    colorBubble.style.transform = "none";
    colorBubble.classList.add("color-bubble--placed");
    updateBubblePanelPlacement();
    for (let i = 0; i < 6; i++) {
      if (!nudgePlacedBubbleForViewport()) break;
    }
    if (!colorPanel.hidden) {
      requestAnimationFrame(() => {
        ensureBubbleInViewport();
      });
    }
  }

  function clampBubbleOnResize(): void {
    if (!colorBubble.classList.contains("color-bubble--placed")) return;
    const r = colorBubble.getBoundingClientRect();
    applyBubblePosition(r.left, r.top);
  }

  function cleanupBubbleDragListeners(): void {
    window.removeEventListener("pointermove", onWindowBubbleMove);
    window.removeEventListener("pointerup", onWindowBubbleUp, true);
    window.removeEventListener("pointercancel", onWindowBubbleUp, true);
  }

  function cancelBubbleDrag(): void {
    if (!bubbleDrag) return;
    cleanupBubbleDragListeners();
    bubbleDrag = null;
  }

  function onWindowBubbleMove(e: PointerEvent): void {
    if (!bubbleDrag || e.pointerId !== bubbleDrag.pointerId) return;
    const dx = e.clientX - bubbleDrag.startClientX;
    const dy = e.clientY - bubbleDrag.startClientY;
    if (!bubbleDrag.moved && Math.hypot(dx, dy) > 6) {
      bubbleDrag.moved = true;
    }
    if (bubbleDrag.moved) {
      applyBubblePosition(bubbleDrag.startLeft + dx, bubbleDrag.startTop + dy);
    }
  }

  function onWindowBubbleUp(e: PointerEvent): void {
    if (!bubbleDrag || e.pointerId !== bubbleDrag.pointerId) return;
    const origin = bubbleDrag.origin;
    const moved = bubbleDrag.moved;
    cancelBubbleDrag();
    if (!moved && origin === "toggle") {
      setColorPanelOpen(colorPanel.hidden);
    }
  }

  function startBubbleDrag(e: PointerEvent, origin: BubbleDragOrigin): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    const r = colorBubble.getBoundingClientRect();
    bubbleDrag = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeft: r.left,
      startTop: r.top,
      moved: false,
      origin,
    };
    window.addEventListener("pointermove", onWindowBubbleMove);
    window.addEventListener("pointerup", onWindowBubbleUp, true);
    window.addEventListener("pointercancel", onWindowBubbleUp, true);
  }

  function onTogglePointerDown(e: PointerEvent): void {
    startBubbleDrag(e, "toggle");
  }

  function onGrabPointerDown(e: PointerEvent): void {
    startBubbleDrag(e, "grab");
  }

  SILK_COLOR_PRESETS.forEach((preset, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch";
    if (i === SILK_COLOR_PRESETS.length - 1) {
      btn.classList.add("color-swatch--center");
    } else {
      btn.style.setProperty("--swatch-i", String(i));
    }
    btn.dataset.base = preset.base;
    btn.dataset.accent = preset.accent;
    btn.style.background = preset.gradient;
    btn.title = `Colors: ${preset.base} → ${preset.accent}`;
    colorRing.appendChild(btn);
  });

  updateColorFab();

  let colorPointerDown: HTMLButtonElement | null = null;

  function onColorGlobalPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !colorPointerDown) return;
    const from = colorPointerDown;
    colorPointerDown = null;
    try {
      from.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const to = under?.closest(".color-swatch") as HTMLButtonElement | null;
    const baseFrom = from.dataset.base;
    const baseTo = to?.dataset.base;
    if (!baseFrom) return;
    if (to && to !== from && baseTo) {
      applySilkColors(baseFrom, baseTo);
    } else if (to === from) {
      const acc = from.dataset.accent;
      if (acc) applySilkColors(baseFrom, acc);
    }
  }

  function onColorRingPointerDown(e: PointerEvent): void {
    const t = (e.target as HTMLElement).closest(".color-swatch");
    if (!t || e.button !== 0) return;
    colorPointerDown = t as HTMLButtonElement;
    (t as HTMLButtonElement).setPointerCapture(e.pointerId);
  }

  colorRing.addEventListener("pointerdown", onColorRingPointerDown);

  colorToggle.addEventListener("pointerdown", onTogglePointerDown);
  colorGrab.addEventListener("pointerdown", onGrabPointerDown);

  window.addEventListener("pointerup", onColorGlobalPointerUp);
  window.addEventListener("pointercancel", onColorGlobalPointerUp);

  window.addEventListener("resize", clampBubbleOnResize);
  updateBubblePanelPlacement();

  function onDocPointerDownClose(e: PointerEvent): void {
    if (colorPanel.hidden) return;
    const t = e.target as Node;
    if (!colorBubble.contains(t)) {
      setColorPanelOpen(false);
    }
  }

  document.addEventListener("pointerdown", onDocPointerDownClose);

  let endTime = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ambientLumaAcc = 0;
  let lastSilkLuma = 0.22;
  let ambientColorAcc = 0;
  let lastColorMask = 0;
  let lastColorDistinct = 0;
  let lastCenterGraySalt = false;
  let lastColorWeights: readonly number[] = [1, 0, 0, 0, 0, 0, 0];
  let lastPlateMeanF = 0;
  let lastPlateRms = 0;
  let lastPlateCoverage = 0;
  /** Smoothed Lissajous offset from ambient `getDriveState` — nudges new curve points */
  let soundDitherX = 0;
  let soundDitherY = 0;

  function tick(): void {
    const startTime = Date.now();
    const dt = (startTime - endTime) / 16;
    stepAutoDrawInput();
    inputFrame();
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]!;
      s.frame();
      if (s.isFinishedDrawing()) {
        strokes.splice(i, 1);
      }
    }
    sparks.frame(dt, sparksUtil.widthOnScreen, sparksUtil.heightOnScreen);
    applyHeartbeatVisual();
    if (ambient.isEnabled()) {
      const motion =
        inputIsActive || (autoDrawEl.checked && !userPointerHeld) ? 1 : 0;
      const energy = Math.min(
        1,
        strokes.length * 0.07 + sparks.points.length * 0.015,
      );
      ambientLumaAcc++;
      if (ambientLumaAcc >= 14) {
        ambientLumaAcc = 0;
        const cw = silkCanvas.width;
        const ch = silkCanvas.height;
        if (cw >= 8 && ch >= 8) {
          const nw = Math.min(48, cw);
          const nh = Math.min(48, ch);
          const sx = Math.floor((cw - nw) / 2);
          const sy = Math.floor((ch - nh) / 2);
          try {
            const id = silkCtx.getImageData(sx, sy, nw, nh);
            let sum = 0;
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
              sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
            }
            const n = d.length / 4;
            lastSilkLuma = n > 0 ? sum / n / 255 : 0;
          } catch {
            /* tainted or unsupported */
          }
        }
      }
      ambientColorAcc++;
      if (ambientColorAcc >= 20) {
        ambientColorAcc = 0;
        const cw = silkCanvas.width;
        const ch = silkCanvas.height;
        if (cw >= 16 && ch >= 16) {
          try {
            const id = silkCtx.getImageData(0, 0, cw, ch);
            const a = analyzeSilkImageData(id);
            lastColorMask = a.mask;
            lastColorDistinct = a.distinctCount;
            lastCenterGraySalt = a.centerGraySalt;
            lastColorWeights = a.presetWeights;

            readHudIntoSettings();
            const motionPlate =
              inputIsActive || (autoDrawEl.checked && !userPointerHeld) ? 1 : 0;
            const energyPlate = Math.min(
              1,
              strokes.length * 0.07 + sparks.points.length * 0.015,
            );
            const inkPlate = Math.min(
              1,
              Math.max(
                0,
                (lastSilkLuma - 0.02) * 5.2 +
                  energyPlate * 0.42 +
                  motionPlate * 0.12,
              ),
            );
            const swp: StandingWaveParams = {
              timeSec: performance.now() / 1000,
              centroidSemitone: centroidSemitoneFromWeights(
                a.presetWeights,
                a.mask,
              ),
              distinctCount: Math.max(1, a.distinctCount),
              symRotations: silkSettings.symNumRotations ?? 1,
              inkStrength: inkPlate,
            };
            const pc = plateCouplingFromImageData(id, swp);
            lastPlateMeanF = pc.meanF;
            lastPlateRms = pc.rmsF;
            lastPlateCoverage = pc.coverage;
          } catch {
            /* tainted or unsupported */
          }
        }
      }
      readHudIntoSettings();
      ambient.update({
        motion,
        energy,
        canvasBrightness: lastSilkLuma,
        colorPresetMask: lastColorMask,
        colorDistinctCount: lastColorDistinct,
        centerGraySalt: lastCenterGraySalt,
        colorPresetWeights: lastColorWeights,
        symRotations: silkSettings.symNumRotations ?? 1,
        plateMeanField: lastPlateMeanF,
        plateRms: lastPlateRms,
        plateCoverage: lastPlateCoverage,
      });
      const drive = ambient.getDriveState();
      if (drive) {
        const wob = 1.05 + drive.ripple * 3.4;
        const melScale = drive.melodyHz * 0.00062;
        const tx =
          Math.sin(drive.flowPhase * 0.52) * wob +
          Math.sin(drive.flowPhase * 1.03 + melScale) * drive.ripple * 1.05;
        const ty =
          Math.cos(drive.flowPhase * 0.49) * wob * 0.9 +
          Math.cos(drive.flowPhase * 0.98 + melScale * 1.1) * drive.ripple * 0.95;
        soundDitherX = soundDitherX * 0.83 + tx * 0.17;
        soundDitherY = soundDitherY * 0.83 + ty * 0.17;
      } else {
        soundDitherX *= 0.87;
        soundDitherY *= 0.87;
      }
    }
    endTime = Date.now();
    const delay = Math.max(0, 16 - (endTime - startTime));
    timer = setTimeout(tick, delay);
  }

  tick();

  sparksCanvas.style.position = "absolute";
  sparksCanvas.style.inset = "0";
  sparksCanvas.style.width = "100%";
  sparksCanvas.style.height = "100%";
  sparksCanvas.style.pointerEvents = "none";
  sparksCanvas.style.zIndex = "1";

  return () => {
    if (timer != null) clearTimeout(timer);
    cancelBubbleDrag();
    window.removeEventListener("resize", resize);
    window.removeEventListener("resize", clampBubbleOnResize);
    window.removeEventListener("pointerup", onColorGlobalPointerUp);
    window.removeEventListener("pointercancel", onColorGlobalPointerUp);
    document.removeEventListener("pointerdown", onDocPointerDownClose);
    colorRing.removeEventListener("pointerdown", onColorRingPointerDown);
    colorToggle.removeEventListener("pointerdown", onTogglePointerDown);
    colorGrab.removeEventListener("pointerdown", onGrabPointerDown);
    silkCanvas.removeEventListener("pointerdown", onPointerDown);
    silkCanvas.removeEventListener("pointermove", onPointerMove);
    silkCanvas.removeEventListener("pointerup", onPointerUp);
    silkCanvas.removeEventListener("pointercancel", onPointerUp);
    silkCanvas.removeEventListener("lostpointercapture", onLostPointerCapture);
    autoDrawEl.removeEventListener("change", onAutoDrawChange);
    autoDrawPresetEl.removeEventListener("change", onAutoDrawPresetChange);
    ambientSoundEl.removeEventListener("change", onAmbientSoundChange);
    document.removeEventListener("visibilitychange", onAmbientVisibility);
    ambient.dispose();
    silkStage.style.transform = "";
    silkCanvas.style.filter = "";
    sparksCanvas.style.filter = "";
    savePngEl.removeEventListener("click", savePng);
  };
}
