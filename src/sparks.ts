type SparkPoint = {
  x: number;
  y: number;
  a: number;
  age: number;
  lifespan: number;
  radius: number;
  radiusScale: number;
  color: string;
  vx: number;
  vy: number;
  invertA?: boolean;
};

export class Sparks {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  points: SparkPoint[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context required");
    this.ctx = ctx;
    this.ctx.globalCompositeOperation = "lighter";
  }

  frame(dt: number, logicalW: number, logicalH: number): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.globalAlpha = 1;
    this.ctx.clearRect(0, 0, logicalW, logicalH);
    this.ctx.restore();
    const points = this.points;
    while (points.length > 0 && points[0]!.age >= points[0]!.lifespan) {
      points.shift();
    }
    for (const p of points) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age++;
      if (p.age < p.lifespan) {
        this.ctx.beginPath();
        let alpha = p.a * (1 - p.age / p.lifespan);
        if (p.invertA) {
          alpha = 1 - alpha;
        }
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.closePath();
      }
    }
  }

  add(x: number, y: number, params: Record<string, unknown>): void {
    const p: SparkPoint = {
      x,
      y,
      a: 1,
      age: 0,
      lifespan: 75,
      radius: 0.75,
      radiusScale: 1,
      color: "#ffffff",
      vx: 2 * Math.random() - 1,
      vy: Math.random() - 1,
      ...(params as Partial<SparkPoint>),
    };
    p.radius *= p.radiusScale;
    this.points.push(p);
  }
}
