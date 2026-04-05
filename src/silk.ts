import { rgb } from "d3-color";
import { interpolateHcl } from "d3-interpolate";
import { scaleLinear, scalePow } from "d3-scale";

export type HighlightMode = "time" | "velocity";

export interface CurvePoint {
  px: number;
  py: number;
  x: number;
  y: number;
  inputVx: number;
  inputVy: number;
  life: number;
  __x__?: number;
  __y__?: number;
}

export interface DrawInstruction {
  rotationIndex: number;
  spiralIndex: number;
  cos: number;
  sin: number;
  scale: number;
  original: boolean;
  mirror?: boolean;
}

export interface ScaleInfo {
  logicalWidth: number;
  logicalHeight: number;
}

export interface SparksApi {
  add(x: number, y: number, params: Record<string, unknown>): void;
}

export type SilkStatePartial = Partial<
  Pick<
    Silk,
    | "symNumRotations"
    | "symMirror"
    | "spiralCopies"
    | "symCenterX"
    | "symCenterY"
    | "color"
    | "highlightColor"
    | "noiseOffset"
    | "curve"
  >
> &
  Record<string, unknown>;

export class Silk {
  ctx: CanvasRenderingContext2D;
  scaleInfo: ScaleInfo;
  curve: CurvePoint[] = [];
  drawInstructions: DrawInstruction[] = [];

  type = "silk";
  version = 1;
  time = 0;
  frameTime = 0;
  completed = false;
  startDrawingOnceCompleted = false;
  stopDrawingOnceCompleted = false;
  brushScale = 1;
  scaleLineWidth = true;
  startLife = 150;
  startOpacity = 0.09;
  color = "#276f9b";
  highlightColor = "#276f9b";
  highlightMode: HighlightMode = "velocity";
  eraserColor = "#000000";
  velocityColorScaleExponent = 1.5;
  velocityColorScaleDomainLow = 10;
  velocityColorScaleDomainHigh = 30;
  timeColorScaleDomainLow = 0;
  timeColorScaleDomainHigh = 350;
  timeColorScaleTime = 0;
  compositeOperation: GlobalCompositeOperation = "lighter";
  noiseForceScale = 1;
  noiseSpaceScale = 0.02;
  noiseTimeScale = 0.005;
  noiseOffset = 0;
  noiseOctaves = 8;
  noiseFallout = 0.65;
  noiseAngleScale = 5 * Math.PI;
  noiseAngleOffset = 0;
  initialVelocityForceScale = 0.3;
  initialVelocityDecay = 0.98;
  windForceScale = 0;
  windAngle = Math.PI;
  rotateAnglesAroundSymmetryAxis = true;
  friction = 0.975;
  restingDistance = 0;
  rigidity = 0.2;
  symType = "point";
  symNumRotations = 1;
  symMirror = true;
  symCenter = "centerScreen";
  symCenterX = 0;
  symCenterY = 0;
  spiralCopies = 1;
  spiralAngle = 0.75 * Math.PI;
  drawsPerFrame = 5;

  originalLogicalWidth!: number;
  originalLogicalHeight!: number;
  drawScale!: number;
  offsetX!: number;
  offsetY!: number;
  cx!: number;
  cy!: number;
  twoCx!: number;
  twoCy!: number;

  sparks?: SparksApi;
  sparkle = false;

  private colorScale!: (t: number) => string;
  isEraser = false;

  constructor(
    ctx: CanvasRenderingContext2D,
    scaleInfo: ScaleInfo,
    state: SilkStatePartial | null,
  ) {
    this.ctx = ctx;
    this.scaleInfo = scaleInfo;
    const s = { ...(state ?? {}) };
    delete s.curve;
    Object.assign(this, s);

    if (this.originalLogicalWidth == null) {
      this.originalLogicalWidth = this.scaleInfo.logicalWidth;
    }
    if (this.originalLogicalHeight == null) {
      this.originalLogicalHeight = this.scaleInfo.logicalHeight;
    }
    this.drawScale = Math.min(
      this.scaleInfo.logicalWidth / this.originalLogicalWidth,
      this.scaleInfo.logicalHeight / this.originalLogicalHeight,
      1,
    );
    this.offsetX = (this.scaleInfo.logicalWidth - this.originalLogicalWidth) / 2;
    this.offsetY = (this.scaleInfo.logicalHeight - this.originalLogicalHeight) / 2;
    this.curve = Array.isArray(state?.curve)
      ? (structuredClone(state.curve) as CurvePoint[])
      : [];
    this.initColors();
    this.cx = this.symCenterX;
    this.cy = this.symCenterY;
    this.twoCx = 2 * this.cx;
    this.twoCy = 2 * this.cy;
    this.generateDrawInstructions();
  }

  initColors(): void {
    switch (this.highlightMode) {
      case "time":
        this.colorScale = scaleLinear<string>()
          .domain([this.timeColorScaleDomainLow, this.timeColorScaleDomainHigh])
          .range([this.highlightColor, this.color])
          .clamp(true)
          .interpolate(interpolateHcl);
        break;
      case "velocity":
        this.colorScale = scalePow<string>()
          .exponent(this.velocityColorScaleExponent)
          .domain([this.velocityColorScaleDomainLow, this.velocityColorScaleDomainHigh])
          .range([this.color, this.highlightColor])
          .clamp(true)
          .interpolate(interpolateHcl);
        break;
    }
    this.isEraser =
      this.color === this.highlightColor && this.highlightColor === this.eraserColor;
  }

  frame(): void {
    this.frameTime++;
    for (let i = 0; i < this.drawsPerFrame; i++) {
      this.step(true);
    }
  }

  step(drawThisStep = true): void {
    if (this.startDrawingOnceCompleted && !this.completed) {
      return;
    }
    const curve = this.curve;
    this.timeColorScaleTime++;
    this.time++;

    while (curve.length > 0 && curve[0]!.life === 0) {
      curve.shift();
    }

    const n = window.noise;
    for (let i = 0; i < curve.length; i++) {
      const p = curve[i]!;
      let accx = 0;
      let accy = 0;
      let symmetryAxisAngle = 0;
      if (this.rotateAnglesAroundSymmetryAxis) {
        symmetryAxisAngle = Math.atan2(this.cx - p.y, this.cy - p.x);
      }
      if (this.noiseForceScale) {
        const noiseValue = n(
          this.noiseOffset + p.x * this.noiseSpaceScale + 1_000_000,
          this.noiseOffset + p.y * this.noiseSpaceScale + 1_000_000,
          this.noiseOffset + this.noiseTimeScale * this.time,
          this.noiseOctaves,
          this.noiseFallout,
        );
        let noiseAngle = this.noiseAngleOffset + this.noiseAngleScale * noiseValue;
        if (this.rotateAnglesAroundSymmetryAxis) {
          noiseAngle += symmetryAxisAngle;
        }
        accx += this.noiseForceScale * Math.cos(noiseAngle);
        accy += this.noiseForceScale * Math.sin(noiseAngle);
      }
      if (this.initialVelocityForceScale) {
        accx += this.initialVelocityForceScale * p.inputVx;
        accy += this.initialVelocityForceScale * p.inputVy;
        if (p.inputVx && p.inputVy) {
          p.inputVx *= this.initialVelocityDecay;
          p.inputVy *= this.initialVelocityDecay;
        }
      }
      if (this.windForceScale > 0) {
        let windAngle = this.windAngle;
        if (this.rotateAnglesAroundSymmetryAxis) {
          windAngle += symmetryAxisAngle;
        }
        accx += this.windForceScale * Math.cos(windAngle);
        accy += this.windForceScale * Math.sin(windAngle);
      }
      p.x += (p.x - p.px) * this.friction + accx;
      p.y += (p.y - p.py) * this.friction + accy;
      p.px = p.x;
      p.py = p.y;
      p.life--;
      if (i) {
        const p2 = curve[i - 1]!;
        const xoff = p2.x - p.x;
        const yoff = p2.y - p.y;
        const dist = Math.sqrt(xoff * xoff + yoff * yoff);
        if (dist > this.restingDistance + 0.01) {
          const difference = (this.rigidity * (this.restingDistance - dist)) / dist;
          const fx = difference * xoff;
          const fy = difference * yoff;
          p.x -= fx;
          p2.x += fx;
          p.y -= fy;
          p2.y += fy;
        }
      }
    }
    if (drawThisStep) {
      this.draw();
    }
  }

  generateDrawInstructions(): void {
    this.drawInstructions = [];
    const rotateAmount = (2 * Math.PI) / this.symNumRotations;
    const spiralScaleScale = scalePow()
      .exponent(0.5)
      .domain([0, 1])
      .range([1, 0]);
    for (let rotationIndex = 0; rotationIndex < this.symNumRotations; rotationIndex++) {
      const rotateBy = rotationIndex * rotateAmount;
      for (let spiralIndex = 0; spiralIndex < this.spiralCopies; spiralIndex++) {
        const pc = spiralIndex / this.spiralCopies;
        const instr: DrawInstruction = {
          rotationIndex,
          spiralIndex,
          cos: Math.cos(rotateBy + this.spiralAngle * pc),
          sin: Math.sin(rotateBy + this.spiralAngle * pc),
          scale: spiralScaleScale(pc) * this.brushScale,
          original: rotationIndex === 0 && spiralIndex === 0,
        };
        this.drawInstructions.push(instr);
        if (this.symMirror) {
          this.drawInstructions.push({ ...instr, mirror: true });
        }
      }
    }
  }

  draw(): void {
    const curve = this.curve;
    this.setColor();
    for (const p of curve) {
      p.__x__ = p.x;
      p.__y__ = p.y;
    }
    for (const instr of this.drawInstructions) {
      this.drawInstruction(instr);
    }
    for (const p of curve) {
      p.x = p.__x__!;
      p.y = p.__y__!;
    }
  }

  drawInstruction(instr: DrawInstruction): void {
    const curve = this.curve;
    const cx = this.cx;
    const cy = this.cy;
    if (this.scaleLineWidth) {
      this.ctx.lineWidth = instr.scale;
    }
    for (const p of curve) {
      let x = p.__x__! - cx;
      let y = p.__y__! - cy;
      p.x = (x * instr.cos - y * instr.sin) * instr.scale;
      p.y = (x * instr.sin + y * instr.cos) * instr.scale;
      if (instr.mirror) {
        p.x = -p.x;
      }
      p.x *= this.drawScale;
      p.y *= this.drawScale;
      p.x += cx;
      p.y += cy;
      p.x += this.offsetX;
      p.y += this.offsetY;
    }
    this.drawCurve(instr);
  }

  drawCurve(instr: DrawInstruction): void {
    const curve = this.curve;
    const ctx = this.ctx;
    if (curve.length === 0) return;
    const lenMinusOne = curve.length - 1;
    if (instr.original && this.frameTime % 10 === 0) {
      this.sparkleLine();
    }
    ctx.beginPath();
    ctx.moveTo(curve[0]!.x, curve[0]!.y);
    if (curve.length < 2) {
      ctx.stroke();
      return;
    }
    let p1 = curve[1]!;
    const limit = lenMinusOne - 1;
    for (let i = 1; i < limit; i++) {
      const p2 = curve[i + 1]!;
      ctx.quadraticCurveTo(p1!.x, p1!.y, (p1!.x + p2.x) / 2, (p1!.y + p2.y) / 2);
      p1 = p2;
    }
    ctx.stroke();
  }

  addPoint(x: number, y: number, vx: number, vy: number): void {
    if (this.completed) return;
    this.curve.push({
      px: x,
      py: y,
      x,
      y,
      inputVx: vx,
      inputVy: vy,
      life: this.startLife,
    });
  }

  complete(): void {
    this.completed = true;
    if (this.stopDrawingOnceCompleted) {
      this.curve = [];
    }
  }

  finish(): void {
    this.complete();
    this.curve = [];
  }

  isFinishedDrawing(): boolean {
    return (
      this.completed && (this.curve.length === 0 || this.stopDrawingOnceCompleted)
    );
  }

  setColor(): void {
    if (this.curve.length === 0) return;
    this.ctx.globalCompositeOperation = this.isEraser
      ? "source-over"
      : this.compositeOperation;
    const p = this.curve[this.curve.length - 1]!;
    this.ctx.globalAlpha = this.startOpacity * (p.life / this.startLife);
    const t =
      this.highlightMode === "time"
        ? this.timeColorScaleTime
        : Math.sqrt(p.inputVx * p.inputVx + p.inputVy * p.inputVy);
    this.ctx.strokeStyle = this.colorScale(t);
  }

  setSparks(sparks: SparksApi): void {
    this.sparks = sparks;
    this.sparkle = true;
  }

  sparkleLine(): void {
    const len = this.curve.length;
    if (len && this.sparkle && this.sparks) {
      const idx = Math.floor(Math.random() * len);
      this.sparklePoint(this.curve[idx]!);
    }
  }

  sparklePoint(p: CurvePoint): void {
    if (this.sparkle && this.sparks) {
      const opacity = 0.8 * (p.life / this.startLife);
      const color = rgb(this.ctx.strokeStyle as string)
        .brighter(2)
        .formatHex();
      this.sparks.add(p.x, p.y, { a: opacity, color });
    }
  }
}
