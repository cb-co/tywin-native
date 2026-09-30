import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";
import { ROSETTE_EXTENT } from "../lib/rosette-svg";

/**
 * Engraved guilloche line work, drawn live on a canvas (the web's
 * components/papel/guilloche.tsx, without React). A rosette is a stack of
 * hypotrochoids, the curve a geometric lathe cuts into a banknote plate; a
 * field is a stack of interfering sine waves. The stroke colour is the
 * canvas's CSS `color`.
 *
 * On first paint the plate "cuts" itself: the curves draw in with an
 * exponential ease-out. Under reduced motion the finished plate is drawn in
 * one frame.
 */
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

let layers: Float32Array[] | null = null;
const rosetteLayers = () => (layers ??= ROSETTE_LAYERS.map(rosettePoints));

function mount(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const variant = canvas.dataset.guilloche === "field" ? "field" : "rosette";
  const lineWidth = Number(canvas.dataset.lineWidth ?? 0.7);
  const duration = Number(canvas.dataset.duration ?? 1800);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let progress = reduce ? 1 : 0;
  let start = 0;

  function draw(p: number) {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";

    if (variant === "rosette") {
      const scale = Math.min(w, h) / 2 / ROSETTE_EXTENT;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      // A slow quarter-turn while the plate cuts: the lathe, not a spinner.
      ctx.rotate((1 - p) * -0.35);
      ctx.scale(scale, scale);
      ctx.lineWidth = lineWidth / scale;
      rosetteLayers().forEach((pts, li) => {
        const n = pts.length / 2;
        const upto = Math.max(2, Math.floor(n * Math.min(1, p * (1 + li * 0.15))));
        ctx.globalAlpha = li === 0 ? 0.9 : 0.55;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 1; i < upto; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
        ctx.stroke();
      });
      ctx.restore();
    } else {
      // Two sine terms per line, phase-shifted per line, so neighbouring
      // lines weave through each other like a note's field.
      const lines = Math.max(18, Math.round(h / 9));
      const gap = h / lines;
      const reach = w * p;
      for (let j = 0; j <= lines; j++) {
        const y0 = j * gap;
        const ph = j * 0.42;
        ctx.globalAlpha = 0.5 + 0.35 * Math.sin(j * 0.7);
        ctx.beginPath();
        for (let x = 0; x <= reach; x += 4) {
          const y = y0 + gap * 1.6 * Math.sin(x / 58 + ph) + gap * 0.9 * Math.sin(x / 23 - ph * 1.7);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  function tick(now: number) {
    if (!start) start = now;
    progress = easeOutExpo((now - start) / duration);
    draw(progress);
    if (progress < 1) requestAnimationFrame(tick);
  }

  if (reduce) draw(1);
  else requestAnimationFrame(tick);
  new ResizeObserver(() => draw(progress)).observe(canvas);
}

document.querySelectorAll<HTMLCanvasElement>("canvas[data-guilloche]").forEach(mount);
