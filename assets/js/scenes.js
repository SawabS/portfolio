/* Miniature animated scenes on the project cards. Each is a small true-to-the-project
 * illustration, and each only runs while its card is on screen. */
window.Scenes = (() => {
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const isDark = () => document.documentElement.dataset.theme === 'dark';

  function ticker(fn, ms) {
    let id = null;
    return { start() { if (!id) { fn(); id = setInterval(fn, ms); } }, stop() { clearInterval(id); id = null; } };
  }
  function raf(fn) {
    let on = false, t0 = 0;
    const loop = t => { if (!on) return; fn((t - t0) / 1000); requestAnimationFrame(loop); };
    return { start() { if (!on) { on = true; t0 = performance.now(); requestAnimationFrame(loop); } }, stop() { on = false; } };
  }
  function fitCanvas(el) {
    const c = document.createElement('canvas');
    el.append(c);
    const g = c.getContext('2d');
    const size = { w: 0, h: 0 };
    const fit = () => {
      const r = el.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      size.w = r.width; size.h = r.height;
      c.width = r.width * d; c.height = r.height * d;
      g.setTransform(d, 0, 0, d, 0, 0);
    };
    fit();
    new ResizeObserver(fit).observe(el);
    return { g, size };
  }

  const builders = {
    // A lesson path filling up, plate by plate
    blueprint(el) {
      const hues = ['blue', 'blue', 'purple', 'purple', 'teal', 'teal'];
      const row = document.createElement('div');
      row.className = 'sc-path';
      row.innerHTML = hues.map((h, i) => `<span class="sc-path__n" style="--i:${i}"><span class="lesson-node" data-state="locked" data-hue="${h}"></span></span>`).join('');
      el.append(row);
      const nodes = [...row.querySelectorAll('.lesson-node')];
      const paint = cur => nodes.forEach((n, i) => {
        const st = i < cur ? 'done' : i === cur ? 'current' : 'locked';
        if (n.dataset.state === st && n.dataset.rendered !== undefined) return;
        n.dataset.state = st; n.dataset.progress = st === 'current' ? 1 : st === 'done' ? 2 : 0;
        delete n.dataset.rendered;
      }) || B.renderNodes(row);
      let cur = 0;
      paint(2);
      return ticker(() => { cur = (cur + 1) % (nodes.length + 1); paint(cur); }, 1000);
    },

    // Documents drifting into topics: embeddings → UMAP → HDBSCAN
    explorer(el) {
      const { g, size } = fitCanvas(el);
      const hues = ['--blue-500', '--orange-500', '--purple-500', '--teal-500', '--pink-500', '--green-500'];
      const pts = Array.from({ length: 220 }, (_, i) => ({ c: i % 6, x: Math.random(), y: Math.random(), rx: Math.random(), ry: Math.random(), a: Math.random() * 6.28, r: Math.pow(Math.random(), .6) }));
      const centers = [[.2, .28], [.5, .2], [.8, .32], [.25, .72], [.56, .66], [.82, .76]];
      return raf(t => {
        const { w, h } = size;
        g.clearRect(0, 0, w, h);
        const cycle = (t % 7) / 7;
        const k = cycle < .14 ? 0 : cycle < .42 ? (cycle - .14) / .28 : cycle < .86 ? 1 : 1 - (cycle - .86) / .14;
        const e = k * k * (3 - 2 * k);
        const grey = isDark() ? '#6e6e6e' : '#b8b4af';
        pts.forEach(p => {
          const [cx, cy] = centers[p.c];
          const tx = cx + Math.cos(p.a) * p.r * .11, ty = cy + Math.sin(p.a) * p.r * .15;
          const x = (p.rx + (tx - p.rx) * e) * w, y = (p.ry + (ty - p.ry) * e) * h;
          g.beginPath(); g.arc(x, y, 3.1, 0, 6.28);
          g.fillStyle = e > .45 ? css(hues[p.c]) : grey;
          g.globalAlpha = .85;
          g.fill();
        });
        g.globalAlpha = 1;
      });
    },

    // A constellation of protocol concepts, with queries travelling the edges
    mcp(el) {
      const { g, size } = fitCanvas(el);
      const N = 30;
      const nodes = Array.from({ length: N }, (_, i) => {
        const a = i * 2.39996, r = Math.sqrt((i + .5) / N);
        return { x: .5 + Math.cos(a) * r * .44, y: .5 + Math.sin(a) * r * .42, s: i < 4 ? 6 : 3.2, ph: i };
      });
      const edges = [];
      nodes.forEach((n, i) => nodes.forEach((m, j) => { if (j > i && Math.hypot(n.x - m.x, n.y - m.y) < .25) edges.push([i, j]); }));
      let mx = -1, my = -1;
      el.parentElement.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height; }, { passive: true });
      el.parentElement.addEventListener('pointerleave', () => { mx = my = -1; });
      return raf(t => {
        const { w, h } = size;
        g.clearRect(0, 0, w, h);
        const ink = css('--purple-500'), line = isDark() ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.1)';
        const pos = nodes.map(n => {
          const d = mx < 0 ? 1 : Math.hypot(n.x - mx, n.y - my), pull = d < .3 ? (.3 - d) * .28 : 0;
          return { x: (n.x + Math.sin(t * .6 + n.ph) * .007 + (mx - n.x) * pull) * w, y: (n.y + Math.cos(t * .5 + n.ph) * .009 + (my - n.y) * pull) * h, n };
        });
        g.lineWidth = 1.4; g.strokeStyle = line;
        edges.forEach(([a, b]) => { g.beginPath(); g.moveTo(pos[a].x, pos[a].y); g.lineTo(pos[b].x, pos[b].y); g.stroke(); });
        g.fillStyle = css('--pear-500');
        edges.forEach(([a, b], i) => {
          if (i % 4) return;
          const f = (t * .34 + i * .13) % 1;
          g.beginPath(); g.arc(pos[a].x + (pos[b].x - pos[a].x) * f, pos[a].y + (pos[b].y - pos[a].y) * f, 2.8, 0, 6.28); g.fill();
        });
        g.fillStyle = ink;
        pos.forEach(p => { g.beginPath(); g.arc(p.x, p.y, p.n.s, 0, 6.28); g.fill(); });
      });
    },

    // A composer that types, then mirrors itself for right-to-left
    noor(el) {
      el.innerHTML = '<div class="sc-noor" dir="ltr"><div class="sc-noor__bubble"></div><div class="sc-noor__bar"><span class="sc-noor__text"></span><span class="sc-noor__caret"></span><span class="sc-noor__send"><svg viewBox="0 0 24 24"><use href="#i-arrow-right"/></svg></span></div></div>';
      const box = el.firstChild, text = box.querySelector('.sc-noor__text'), bubble = box.querySelector('.sc-noor__bubble');
      const script = [{ s: 'Hello, Noor', dir: 'ltr' }, { s: 'سڵاو نوور', dir: 'rtl' }, { s: 'مرحبا نور', dir: 'rtl' }];
      let line = 0, ch = 0, hold = 0;
      return ticker(() => {
        const cur = script[line], chars = Array.from(cur.s);
        if (ch === 0) { box.dir = cur.dir; bubble.textContent = ''; bubble.classList.remove('on'); }
        if (ch < chars.length) { text.textContent = chars.slice(0, ++ch).join(''); return; }
        if (hold === 3) { bubble.textContent = cur.s; bubble.classList.add('on'); text.textContent = ''; }
        if (++hold > 13) { hold = 0; ch = 0; line = (line + 1) % script.length; text.textContent = ''; }
      }, 130);
    },

    // The real opening verse of Bêyta Dilî, inked in line by line (text from the Vejin site)
    vejin(el) {
      const lines = ['دلۆ رابە، دلۆ رابە', 'ڤەکە چاڤان کو ئێڤارە', 'نەزانۆ بەس د خەو دابە', 'ب نەومێڕا مەبە یارە'];
      el.innerHTML = '<div class="sc-verse" dir="rtl" lang="ku">' + lines.map(l => `<span class="sc-verse__l">${l}</span>`).join('') + '</div>';
      const ls = [...el.querySelectorAll('.sc-verse__l')];
      let i = 0;
      return ticker(() => {
        if (i >= ls.length + 3) { ls.forEach(l => l.classList.remove('on')); i = 0; return; }
        if (ls[i]) ls[i].classList.add('on');
        i++;
      }, 1000);
    },

    // A to-scale schedule with a sweeping Now marker
    hitex(el) {
      const rows = [[[0, 18], [21, 15], [40, 26], [70, 26]], [[6, 30], [40, 12], [56, 18], [78, 18]], [[0, 12], [15, 34], [53, 20], [76, 20]]];
      el.innerHTML = '<div class="sc-sched">' + rows.map(r => '<div class="sc-sched__row">' + r.map(([x, w]) => `<span class="sc-sched__b" data-x="${x}" data-w="${w}" style="left:${x}%;width:${w}%"></span>`).join('') + '</div>').join('') + '<span class="sc-sched__now"><i>Now</i></span></div>';
      const now = el.querySelector('.sc-sched__now'), blocks = [...el.querySelectorAll('.sc-sched__b')];
      return raf(t => {
        const p = (t * 7) % 100;
        now.style.left = p + '%';
        blocks.forEach(b => b.classList.toggle('on', p >= +b.dataset.x && p <= +b.dataset.x + +b.dataset.w));
      });
    },

    // A manuscript travelling ten stages to its DOI
    aro(el) {
      const d = 'M 36 200 C 110 200, 90 90, 170 90 S 250 200, 320 150 S 400 60, 450 70';
      const dots = Array.from({ length: 10 }, (_, i) => `<circle class="sc-aro__dot" r="6" style="--i:${i}; offset-path: path('${d}'); offset-distance: ${i / 9 * 100}%; offset-rotate: 0deg"/>`).join('');
      el.innerHTML = `<svg class="sc-aro" viewBox="0 0 486 280"><path class="sc-aro__track" d="${d}"/>${dots}<g class="sc-aro__doc" style="offset-path: path('${d}'); offset-rotate: 0deg"><rect x="-17" y="-40" width="34" height="42" rx="6"/><path d="M-9 -29h18M-9 -21h18M-9 -13h11"/></g><g class="sc-aro__badge" transform="translate(450 112)"><rect x="-23" y="-12" width="46" height="24" rx="12"/><text text-anchor="middle" y="4.5">DOI</text></g></svg>`;
      return { start() {}, stop() {} };
    },

    // Fuzzy inference: rules fire, areas clip, the centroid lands on 3000 rpm
    fuzzy(el) {
      const tri = (a, b, c) => `M${a} 170 L${b} 50 L${c} 170 Z`;
      el.innerHTML = `<svg class="sc-fuzzy" viewBox="0 0 460 240"><line x1="40" y1="170" x2="420" y2="170" class="sc-fuzzy__axis"/>
        <defs><clipPath id="fz-cut"><rect class="sc-fuzzy__cut" x="30" y="50" width="400" height="120"/></clipPath></defs>
        <path d="${tri(40, 130, 220)}" class="sc-fuzzy__t"/><path d="${tri(140, 230, 320)}" class="sc-fuzzy__t"/><path d="${tri(240, 330, 420)}" class="sc-fuzzy__t"/>
        <g clip-path="url(#fz-cut)"><path d="${tri(40, 130, 220)}" class="sc-fuzzy__f sc-fuzzy__f--a"/><path d="${tri(140, 230, 320)}" class="sc-fuzzy__f sc-fuzzy__f--b"/><path d="${tri(240, 330, 420)}" class="sc-fuzzy__f sc-fuzzy__f--c"/></g>
        <g class="sc-fuzzy__needle"><line x1="0" y1="34" x2="0" y2="170"/><circle r="6" cy="34"/></g>
        <text x="230" y="208" text-anchor="middle" class="sc-fuzzy__out">3000 rpm</text></svg>`;
      return { start() {}, stop() {} };
    },
  };

  function mount(root = document) {
    root.querySelectorAll('.scene[data-scene]').forEach(el => {
      const make = builders[el.dataset.scene];
      if (!make) return;
      const scene = make(el);
      if (calm()) { scene.start(); requestAnimationFrame(() => scene.stop()); return; }
      new IntersectionObserver(([e]) => { e.isIntersecting ? scene.start() : scene.stop(); el.classList.toggle('is-on', e.isIntersecting); }, { rootMargin: '60px' }).observe(el);
    });
  }
  return { mount };
})();
