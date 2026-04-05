import { CanvasUtil } from "./canvas-util";
import { SILK_COLOR_PRESETS } from "./silk-colors";
import { Silk, type ScaleInfo, type SilkStatePartial } from "./silk";
import { Sparks } from "./sparks";

function deepSilkSettings(base: SilkStatePartial): SilkStatePartial {
  return structuredClone(base) as SilkStatePartial;
}

export function mount(root: HTMLElement): () => void {
  const silkCanvas = root.querySelector<HTMLCanvasElement>("#silk")!;
  const sparksCanvas = document.createElement("canvas");
  sparksCanvas.id = "sparks";
  sparksCanvas.setAttribute("aria-hidden", "true");
  root.appendChild(sparksCanvas);

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
  const spiralEl = root.querySelector<HTMLInputElement>("#spiral")!;
  const clearEl = root.querySelector<HTMLButtonElement>("#clear")!;
  const savePngEl = root.querySelector<HTMLButtonElement>("#save-png")!;
  const colorBubble = root.querySelector<HTMLElement>("#color-bubble")!;
  const colorToggle = root.querySelector<HTMLButtonElement>("#color-bubble-toggle")!;
  const colorPanel = root.querySelector<HTMLElement>("#color-bubble-panel")!;
  const colorGrab = colorPanel.querySelector<HTMLElement>(".color-bubble-grab")!;
  const colorRing = root.querySelector<HTMLElement>("#color-swatch-ring")!;

  function readHudIntoSettings(): void {
    silkSettings.symMirror = mirrorEl.checked;
    silkSettings.symNumRotations = Math.max(
      1,
      Math.min(12, Math.floor(Number(rotationsEl.value) || 1)),
    );
    silkSettings.spiralCopies = spiralEl.checked ? 30 : 1;
  }

  mirrorEl.addEventListener("change", readHudIntoSettings);
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

  function logicalFromEvent(clientX: number, clientY: number): { x: number; y: number } {
    const r = silkCanvas.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    return { x, y };
  }

  function inputFrame(): void {
    if (
      pinputX != null &&
      pinputY != null &&
      currentStroke &&
      inputIsActive
    ) {
      currentStroke.addPoint(inputX, inputY, inputX - pinputX, inputY - pinputY);
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
    const { x, y } = logicalFromEvent(e.clientX, e.clientY);
    inputX = x;
    inputY = y;
    endStroke();
  }

  silkCanvas.addEventListener("pointerdown", onPointerDown);
  silkCanvas.addEventListener("pointermove", onPointerMove);
  silkCanvas.addEventListener("pointerup", onPointerUp);
  silkCanvas.addEventListener("pointercancel", onPointerUp);

  clearEl.addEventListener("click", () => {
    silkUtil.fillSolid("#000");
    sparks.points.length = 0;
    strokes.length = 0;
    currentStroke = null;
    inputIsActive = false;
    pinputX = null;
    pinputY = null;
  });

  function savePng(): void {
    const w = silkCanvas.width;
    const h = silkCanvas.height;
    if (w === 0 || h === 0) return;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    if (!octx) return;
    octx.drawImage(silkCanvas, 0, 0);
    if (sparksCanvas.width === w && sparksCanvas.height === h) {
      octx.drawImage(sparksCanvas, 0, 0);
    } else {
      octx.drawImage(
        sparksCanvas,
        0,
        0,
        sparksCanvas.width,
        sparksCanvas.height,
        0,
        0,
        w,
        h,
      );
    }
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `silk-port-${Date.now()}.png`;
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

  function tick(): void {
    const startTime = Date.now();
    const dt = (startTime - endTime) / 16;
    inputFrame();
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]!;
      s.frame();
      if (s.isFinishedDrawing()) {
        strokes.splice(i, 1);
      }
    }
    sparks.frame(dt, sparksUtil.widthOnScreen, sparksUtil.heightOnScreen);
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
    savePngEl.removeEventListener("click", savePng);
  };
}
