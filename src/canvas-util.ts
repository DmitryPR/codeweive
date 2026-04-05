/** HiDPI canvas sizing aligned with weavesilk.com CanvasUtil (no MobileDetect shortcut). */
export class CanvasUtil {
  canvas: HTMLCanvasElement;
  widthOnScreen = 0;
  heightOnScreen = 0;
  halfWidthOnScreen = 0;
  halfHeightOnScreen = 0;
  scaleRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  updateSizeOnScreen(width: number, height: number): void {
    this.widthOnScreen = width;
    this.halfWidthOnScreen = width / 2;
    this.heightOnScreen = height;
    this.halfHeightOnScreen = height / 2;
  }

  transformAndResizeForHighDPI(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const c = ctx as CanvasRenderingContext2D & {
      webkitBackingStorePixelRatio?: number;
      mozBackingStorePixelRatio?: number;
      msBackingStorePixelRatio?: number;
      oBackingStorePixelRatio?: number;
      backingStorePixelRatio?: number;
    };
    const backingStoreRatio =
      c.webkitBackingStorePixelRatio ||
      c.mozBackingStorePixelRatio ||
      c.msBackingStorePixelRatio ||
      c.oBackingStorePixelRatio ||
      c.backingStorePixelRatio ||
      1;
    this.scaleRatio = devicePixelRatio / backingStoreRatio;
    if (this.scaleRatio !== 1) {
      this.canvas.width = this.widthOnScreen * this.scaleRatio;
      this.canvas.height = this.heightOnScreen * this.scaleRatio;
      this.canvas.style.width = `${this.widthOnScreen}px`;
      this.canvas.style.height = `${this.heightOnScreen}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(this.scaleRatio, this.scaleRatio);
    }
  }

  resizeToWindow(): void {
    this.resizeCanvas(window.innerWidth, window.innerHeight);
  }

  resizeCanvas(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.updateSizeOnScreen(width, height);
    this.transformAndResizeForHighDPI();
  }

  /** Replace every pixel; must reset blend mode — `lighter` + black does not erase. */
  fillSolid(color: string): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
}
