/* Interfering waves: two sine terms per line, phase-shifted per line, so
   neighbouring lines weave through each other like a note's field. Its
   geometry depends on the element's size, so it is drawn at runtime. */
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

function mount(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
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

document.querySelectorAll<HTMLCanvasElement>("canvas[data-guilloche-field]").forEach(mount);
