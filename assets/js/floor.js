/* The hero floor: the isometric lattice as a living surface. Cells rise as tiles under
 * the pointer on a spring, each carrying a Kurdish letter. A click sends a shockwave.
 * When nobody is pointing, a slow ghost wanders so phones and idle screens stay alive. */
(() => {
  const canvas = document.getElementById('floor');
  if (!canvas) return;
  const hero = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const A = 36, B_ = 21;                         // half-width and half-height of a cell: the 72×42 lattice tile
  const U = [A / 42, B_ / 42], V = [-A / 42, B_ / 42]; // the floor plane's axes, for laying letters flat on a tile
  const HUES = ['blue', 'purple', 'teal', 'pink', 'orange', 'mint', 'pear', 'papaya'];
  const LETTERS = 'ئابپتجچحخدرڕزژسشعغفڤقکگلڵمنهەوۆیێ'.split('');

  let W = 0, H = 0, dpr = 1, floorH = 0, cells = [], palette = {}, base = null;
  let running = false, visible = true, last = 0, lastPointer = -1e9;
  let px = -1e4, py = -1e4, gx = 0, gy = 0;
  const waves = [];

  function readPalette() {
    const css = getComputedStyle(document.documentElement);
    HUES.forEach(h => {
      palette[h] = { top: css.getPropertyValue(`--${h}-400`).trim(), left: css.getPropertyValue(`--${h}-600`).trim(), right: css.getPropertyValue(`--${h}-700`).trim() };
    });
    palette.line = document.documentElement.dataset.theme === 'dark' ? '#4a4a4a' : '#e2dbd3';
    palette.lineFade = document.documentElement.dataset.theme === 'dark' ? '#383838' : '#f5f3f1';
  }

  function hueAt(r, k) {   // broad colour patches rather than confetti
    const n = (Math.sin(k * .42 + r * .13) + Math.cos(r * .31 - k * .17) + 2) / 4;
    return HUES[Math.min(HUES.length - 1, Math.floor(n * HUES.length))];
  }

  function layout() {
    const box = hero.getBoundingClientRect();
    W = Math.round(box.width); H = Math.round(box.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    floorH = Math.min(H * .55, 440);
    const rows = Math.ceil(floorH / B_);
    const mid = W / 2, cols = Math.ceil(W / (A * 2)) + 2;
    cells = [];
    for (let r = rows; r >= 0; r--) {             // back rows first, so nearer tiles overlap them
      const off = r % 2 ? A : 0;
      for (let k = -cols; k <= cols; k++) {
        const x = mid + k * A * 2 + off, y = H - r * B_;
        if (x < -A || x > W + A) continue;
        cells.push({
          x, y, z: 0, v: 0, r, hue: hueAt(r, k),
          fade: Math.max(0, Math.min(1, (1 - (r * B_) / floorH) / .4)),
          gain: .72 + ((r * 7 + k * 13) % 9 + 9) % 9 / 20,
          letter: LETTERS[((r * 11 + k * 7) % LETTERS.length + LETTERS.length) % LETTERS.length],
        });
      }
    }
    paintBase();
  }

  function paintBase() {   // the resting lattice, cached to an offscreen canvas
    base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const c = base.getContext('2d');
    c.scale(dpr, dpr);
    const grad = c.createLinearGradient(0, H - floorH, 0, H);
    grad.addColorStop(0, palette.lineFade);
    grad.addColorStop(.42, palette.line);
    c.strokeStyle = grad; c.lineWidth = 1.1;
    c.beginPath();
    const dx = floorH * (A / B_);
    for (let x = -dx - A * 2; x < W + dx + A * 2; x += A * 2) {
      const sx = W / 2 + Math.round((x - W / 2) / (A * 2)) * A * 2;
      c.moveTo(sx, H); c.lineTo(sx - dx, H - floorH);
      c.moveTo(sx, H); c.lineTo(sx + dx, H - floorH);
    }
    c.stroke();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    for (const c of cells) {
      if (c.z < 1 || c.fade <= 0) continue;
      const { x, y, z } = c, p = palette[c.hue];
      ctx.globalAlpha = c.fade;
      ctx.fillStyle = p.left;
      ctx.beginPath(); ctx.moveTo(x - A, y - B_); ctx.lineTo(x, y); ctx.lineTo(x, y - z); ctx.lineTo(x - A, y - B_ - z); ctx.closePath(); ctx.fill();
      ctx.fillStyle = p.right;
      ctx.beginPath(); ctx.moveTo(x + A, y - B_); ctx.lineTo(x, y); ctx.lineTo(x, y - z); ctx.lineTo(x + A, y - B_ - z); ctx.closePath(); ctx.fill();
      ctx.fillStyle = p.top;
      ctx.beginPath(); ctx.moveTo(x, y - z); ctx.lineTo(x + A, y - B_ - z); ctx.lineTo(x, y - 2 * B_ - z); ctx.lineTo(x - A, y - B_ - z); ctx.closePath(); ctx.fill();
      if (z > 9) {
        ctx.globalAlpha = c.fade * Math.min(1, (z - 9) / 12);
        ctx.setTransform(dpr * U[0], dpr * U[1], dpr * V[0], dpr * V[1], dpr * x, dpr * (y - B_ - z));
        ctx.fillStyle = 'rgba(0, 0, 0, .78)';
        ctx.font = '500 25px "Noto Naskh Arabic", serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.letter, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    ctx.globalAlpha = 1;
  }

  function step(dt, now) {
    const idle = now - lastPointer > 2600;
    if (idle) {
      const t = now / 1000;
      gx = W * (.5 + .36 * Math.sin(t * .29));
      gy = H - floorH * (.3 + .14 * Math.sin(t * .47 + 1));
    }
    const qx = idle ? gx : px, qy = idle ? gy : py;
    const R = idle ? 150 : 185, peak = idle ? 42 : 78;
    for (let i = waves.length - 1; i >= 0; i--) if (now - waves[i].t0 > 2600) waves.splice(i, 1);
    for (const c of cells) {
      const cy = c.y - B_;
      const d = Math.hypot(c.x - qx, (cy - qy) * 1.7);
      let target = 0;
      if (d < R) { const n = 1 - d / R; target = n * n * (3 - 2 * n) * peak * c.gain; }
      for (const w of waves) {
        const age = (now - w.t0) / 1000;
        const dw = Math.hypot(c.x - w.x, (cy - w.y) * 1.7);
        const front = (dw - age * w.speed) / w.width;
        if (Math.abs(front) < 3) target += w.amp * c.gain * Math.exp(-front * front) * Math.max(0, 1 - age / 2.4);
      }
      c.v += ((target - c.z) * 95 - c.v * 11.5) * dt;
      c.z += c.v * dt;
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    step(dt, now);
    draw();
    requestAnimationFrame(frame);
  }
  function start() { if (running || calm || !visible) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function stop() { running = false; }

  function shock(x, y, amp = 56) { waves.push({ x, y, t0: performance.now(), speed: 620, width: 62, amp }); start(); }

  hero.addEventListener('pointermove', e => {
    const b = canvas.getBoundingClientRect();
    px = e.clientX - b.left; py = e.clientY - b.top;
    lastPointer = performance.now();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { px = py = -1e4; });
  hero.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button, input, .hero-card')) return;
    const b = canvas.getBoundingClientRect();
    shock(e.clientX - b.left, e.clientY - b.top, 64);
    window.B && B.sfx.tap();
  });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(hero);
  new MutationObserver(() => { readPalette(); paintBase(); if (!running) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); if (!running) draw(); }, 80); }).observe(hero);

  readPalette();
  layout();
  if (calm) {
    // a still composition: one quiet swell of tiles, no loop
    cells.forEach(c => { const d = Math.hypot(c.x - W * .72, (c.y - H + floorH * .3) * 1.7); if (d < 190) { const n = 1 - d / 190; c.z = n * n * (3 - 2 * n) * 60 * c.gain; } });
    draw();
    return;
  }
  document.fonts && document.fonts.load('500 25px "Noto Naskh Arabic"', 'ڤ');
  start();
  setTimeout(() => shock(W / 2, H - 40, 62), 450);   // the floor wakes up once on load
})();
