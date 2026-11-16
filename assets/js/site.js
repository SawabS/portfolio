/* Page behaviour: reveals, XP, the tokenizer widgets, the career path,
 * project filter, the pinned stack, the quiz and the small things in the contact band. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ── XP: earned once per discovery ── */
  const earned = new Set();
  let xp = 0;
  function award(key, n) {
    if (earned.has(key)) return;
    earned.add(key);
    xp += n;
    $('#xpFinal').textContent = xp;   // shown once, at the end of the quiz
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('#toastWrap').append(t);
    setTimeout(() => t.remove(), 2400);
  }

  /* ── Reveals ── */
  $$('[data-split]').forEach(h => {
    // wrap each word so headings can rise word by word; <em> stays intact
    const wrap = node => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.append(' '); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.append(s);
        });
        else { const s = document.createElement('span'); s.className = 'w'; s.append(n.cloneNode(true)); frag.append(s); }
      });
      return frag;
    };
    h.setAttribute('aria-label', h.textContent);
    h.replaceChildren(wrap(h));
    $$('.w', h).forEach((w, i) => w.style.setProperty('--d', i));
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    $$('[data-count]', e.target).forEach(countUp);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .06 });
  $$('[data-reveal], [data-split]').forEach(el => io.observe(el));

  /* Odometer-style count-up with a spring-ish settle */
  function countUp(el) {
    if (calm) return;
    const to = +el.dataset.count, dec = +(el.dataset.decimals || 0), t0 = performance.now(), dur = 1500;
    const fmt = v => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
    el.style.minWidth = fmt(to).length + 'ch';
    (function tick(t) {
      const p = clamp((t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* Hero word swaps between its two scripts */
  if (!calm) {
    const swap = $('#heroSwap');
    setInterval(() => swap.classList.toggle('alt'), 3400);
  }

  /* ── Theme: the new palette grows out of the button as a circle ── */
  const themeBtn = $('#themeBtn');
  const syncThemeIcon = () => $('.theme-icon').setAttribute('href', document.documentElement.dataset.theme === 'dark' ? '#i-sun' : '#i-moon');
  syncThemeIcon();
  themeBtn.addEventListener('click', e => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => { B.setTheme(next); syncThemeIcon(); };
    if (!document.startViewTransition || calm) { apply(); return; }
    const x = e.clientX || innerWidth - 40, y = e.clientY || 40;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      document.documentElement.animate({ clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 620, easing: 'cubic-bezier(.3, .8, .3, 1)', pseudoElement: '::view-transition-new(root)' });
    });
    award('theme', 5);
  });
  const soundBtn = $('#soundBtn');
  const syncSound = () => { soundBtn.setAttribute('aria-pressed', B.sfx.enabled); $('use', soundBtn).setAttribute('href', B.sfx.enabled ? '#i-sound' : '#i-mute'); };
  syncSound();
  soundBtn.addEventListener('click', () => { B.sfx.setEnabled(!B.sfx.enabled); syncSound(); });

  /* ── Hero tokenizer: learns on its own once, then it's yours ── */
  (function hero() {
    const s = Tok.SAMPLES.bahdini, model = Tok.train(s.corpus, 'chars');
    const view = new Tok.View($('#heroTiles')), slider = $('#heroSlider'), out = $('#heroTokens'), hint = $('#heroHint');
    const goal = Tok.mergesToJoin(s.target, model);
    slider.max = model.merges.length;
    let k = -1;
    const set = (n, animate = true) => {
      if (n === k) return;
      k = n;
      slider.value = n;
      slider.style.setProperty('--value', (n / model.merges.length * 100) + '%');
      const words = Tok.segment(s.show, model, n);
      view.render(words, 'chars', { animate });
      out.textContent = words.flat().length;
    };
    let auto = null;
    const stopAuto = () => { clearInterval(auto); auto = null; };
    slider.addEventListener('input', () => {
      stopAuto(); set(+slider.value);
      hint.textContent = 'A real BPE tokenizer';
      award('hero-slider', 10);
    });
    set(0, false);
    if (calm) { set(goal, false); hint.textContent = 'Drag to change the merges'; return; }
    setTimeout(() => {
      let n = 0;
      auto = setInterval(() => {
        if (++n >= goal) { stopAuto(); hint.textContent = 'Now drag it yourself'; slider.classList.add('slider--nudge'); }
        set(n);
      }, 200);
    }, 1500);
  })();

  /* ── Full explorer ── */
  (function explorer() {
    const view = new Tok.View($('#tiles')), slider = $('#mergeSlider'), tilesEl = $('#tiles');
    const state = { lang: 'bahdini', unit: 'chars', text: '', model: null, alt: null, sample: null, solved: {} };
    const customDefault = $('#customText').placeholder;

    function retrain() {
      const custom = state.lang === 'custom';
      const raw = $('#customText').value.trim();
      state.sample = custom ? { show: raw || customDefault, corpus: [raw || customDefault], gloss: 'Trained only on what you typed', target: null } : Tok.SAMPLES[state.lang];
      state.model = Tok.train(state.sample.corpus, state.unit);
      state.alt = Tok.train(state.sample.corpus, state.unit === 'chars' ? 'bytes' : 'chars');
      state.goal = state.sample.target ? Tok.mergesToJoin(state.sample.target, state.model) : -1;
      slider.max = Math.max(1, state.model.merges.length);
      const rtl = /[֐-ࣿ]/.test(state.sample.show);
      tilesEl.dir = rtl ? 'rtl' : 'ltr';
      tilesEl.lang = rtl ? 'ckb' : 'en';
      $('#gloss').textContent = state.sample.gloss;
      const bytes = new TextEncoder().encode(state.sample.show.replace(/\s/g, '')).length, letters = Array.from(state.sample.show.replace(/\s/g, '')).length;
      $('#rBytes').textContent = (bytes / letters).toFixed(1);
      slider.value = 0;
      update(false);
    }

    function update(animate = true) {
      const k = +slider.value, { model, sample } = state;
      slider.style.setProperty('--value', (k / slider.max * 100) + '%');
      const words = Tok.segment(sample.show, model, k);
      view.render(words, state.unit, { animate });
      $('#mergeN').textContent = k;
      $('#rTokens').textContent = words.flat().length;
      $('#rVocab').textContent = model.vocabBase + k;
      const m = model.merges[k - 1];
      const log = $('#mergeLog');
      if (!m) log.textContent = state.unit === 'bytes' ? 'No merges yet. Every byte is its own token.' : 'No merges yet. Every letter is its own token.';
      else {
        const a = Tok.label(m.a, state.unit).text, b = Tok.label(m.b, state.unit).text, ab = Tok.label(m.a + m.b, state.unit).text;
        log.replaceChildren(`Merge ${k}: `, bdi(a), ' + ', bdi(b), ' → ', bdi(ab, true), m.n === 1 ? ' (seen once)' : ` (seen ${m.n} times)`);
      }
      drawCurve(k);
      updateGoal(words, k);
    }
    const bdi = (t, strong) => { const e = document.createElement(strong ? 'b' : 'bdi'); if (strong) { const i = document.createElement('bdi'); i.textContent = t; e.append(i); } else e.textContent = t; return e; };

    function updateGoal(words, k) {
      const box = $('#goal'), title = $('#goalTitle'), text = $('#goalText');
      const { sample, unit, goal } = state;
      box.hidden = !sample.target;
      if (!sample.target) return;
      const pieces = Tok.segment(sample.target, state.model, k)[0].length;
      const key = state.lang + unit;
      if (pieces === 1) {
        title.textContent = 'Correct!';
        text.replaceChildren(bdi(sample.target), ` is one token after ${goal} merges` + (unit === 'bytes' ? '. Starting from bytes, the first merges only rebuild letters.' : '. Now try the same goal from bytes.'));
        box.classList.add('goal--done');
        if (!state.solved[key]) { state.solved[key] = true; B.sfx.correct(); award('goal-' + key, 20); }
      } else {
        title.textContent = 'Goal';
        text.replaceChildren('Drag until ', bdi(sample.target), ` is one token. Right now it's in ${pieces} pieces.`);
        box.classList.remove('goal--done');
      }
    }

    function drawCurve(k) {
      const svg = $('#curve'), W = 420, H = 150, L = 34, R = 66, T = 10, B_ = 24;
      const { model, alt } = state;
      const chars = model.mode === 'chars' ? model : alt, bytes = model.mode === 'bytes' ? model : alt;
      const maxX = Math.max(bytes.curve.length, chars.curve.length) - 1 || 1;
      const maxY = Math.max(bytes.curve[0], chars.curve[0]) || 1;
      const X = i => L + (W - L - R) * i / maxX, Y = v => T + (H - T - B_) * (1 - v / maxY);
      const line = c => c.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
      const cur = model.curve[Math.min(k, model.curve.length - 1)];
      const altName = alt.mode === 'bytes' ? 'From bytes' : 'From letters', name = model.mode === 'bytes' ? 'From bytes' : 'From letters';
      const same = alt.curve.join() === model.curve.join();  // pure ASCII: one byte per letter, so the two runs are identical
      const endX = c => X(c.length - 1) + 7, endY = c => Y(c[c.length - 1]);
      const labels = same
        ? `<text class="c-lab" x="${W - R}" y="${Y(maxY * .78)}" text-anchor="end">Letters and bytes match</text>`
        : `<text class="c-lab c-lab--alt" x="${endX(alt.curve)}" y="${endY(alt.curve) + (alt.mode === 'bytes' ? -4 : 12)}">${altName}</text>
           <text class="c-lab" x="${endX(model.curve)}" y="${endY(model.curve) + (model.mode === 'bytes' ? -4 : 12)}">${name}</text>`;
      svg.innerHTML = `
        <line class="c-grid" x1="${L}" x2="${W - R}" y1="${Y(maxY)}" y2="${Y(maxY)}"/><line class="c-grid" x1="${L}" x2="${W - R}" y1="${Y(maxY / 2)}" y2="${Y(maxY / 2)}"/>
        <line class="c-base" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>
        <text class="c-tick" x="${L - 7}" y="${Y(maxY) + 4}" text-anchor="end">${maxY}</text><text class="c-tick" x="${L - 7}" y="${Y(maxY / 2) + 4}" text-anchor="end">${Math.round(maxY / 2)}</text><text class="c-tick" x="${L - 7}" y="${Y(0) + 4}" text-anchor="end">0</text>
        <text class="c-tick" x="${L}" y="${H - 6}">0 merges</text><text class="c-tick" x="${W - R}" y="${H - 6}" text-anchor="end">${maxX}</text>
        <path class="c-alt" d="${line(alt.curve)}"/><path class="c-main" d="${line(model.curve)}"/>
        ${labels}
        <line class="c-drop" x1="${X(k)}" x2="${X(k)}" y1="${Y(cur)}" y2="${Y(0)}"/>
        <circle class="c-dot" cx="${X(k)}" cy="${Y(cur)}" r="6"/>
        <text class="c-lab" x="${X(k) + 8}" y="${Y(cur) - 9}">${cur}</text>`;
    }

    slider.addEventListener('input', () => { update(); award('explorer-slider', 10); });
    $$('#langChips .chip').forEach(b => b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      $('#customField').hidden = state.lang !== 'custom';
      retrain();
      award('lang-' + state.lang, 5);
    }));
    $$('#unitSeg button').forEach(b => b.addEventListener('click', () => { state.unit = b.dataset.unit; retrain(); award('bytes', 5); }));
    let typing;
    $('#customText').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(retrain, 120); award('typed', 15); });
    retrain();
  })();

  /* ── Career path ── */
  (function path() {
    const col = $('#pathCol'), card = $('#pathCard');
    const rows = $$('.path__row', col);
    const nodes = rows.map(r => $('.lesson-node', r));
    const finals = nodes.map(n => ({ state: n.dataset.state, progress: n.dataset.progress }));
    let active = -1, pinnedByClick = 0;

    function setNode(i, st) {
      const n = nodes[i];
      if (n.dataset.state === st) return;
      n.dataset.state = st;
      if (st === 'locked') delete n.dataset.progress;
      else if (finals[i].progress !== undefined) n.dataset.progress = finals[i].progress;
      else delete n.dataset.progress;
      delete n.dataset.rendered;
      B.renderNodes(n.parentElement);
      if (st !== 'locked' && !calm) n.animate([{ transform: 'scale(.72)' }, { transform: 'scale(1.07)', offset: .6 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2, 1.1, .36, 1)' });
    }

    function activate(i) {
      if (i === active) return;
      active = i;
      rows.forEach((r, k) => { r.classList.toggle('is-active', k === i); $('.path__item', r).setAttribute('aria-expanded', k === i); });
      if (i < 0) return;
      card.innerHTML = $('.path__detail', rows[i]).innerHTML;
      card.classList.remove('swap-in'); void card.offsetWidth; card.classList.add('swap-in');
    }

    // Beside the sticky card, scrolling drives the selection. On phones the details sit inline,
    // so only a tap may open them: changing height under a scrolling finger would make the page jump.
    const wide = () => innerWidth >= 992;
    rows.forEach((r, i) => $('.path__item', r).addEventListener('click', () => {
      pinnedByClick = performance.now();
      activate(!wide() && i === active ? -1 : i);
      award('path-' + i, 5);
    }));

    // the line between the plates is drawn from their measured positions
    const svg = $('#pathLine'), base = $('.path-line__base', svg), ink = $('.path-line__ink', svg);
    let centers = [];
    function layoutLine() {
      const b = col.getBoundingClientRect();
      svg.setAttribute('width', b.width); svg.setAttribute('height', b.height);
      svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
      centers = nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height * .68 }; });
      const d = centers.map((p, i) => {
        if (!i) return `M${p.x} ${p.y}`;
        const q = centers[i - 1], my = (p.y + q.y) / 2;
        return `C${q.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`;
      }).join(' ');
      base.setAttribute('d', d); ink.setAttribute('d', d);
      const len = ink.getTotalLength();
      ink.style.strokeDasharray = len;
      svg.dataset.len = len;
      scroll();
    }

    function scroll() {
      if (!centers.length) return;
      const b = col.getBoundingClientRect(), line = innerHeight * .58;
      const y = line - b.top, len = +svg.dataset.len;
      const last = centers.length - 2;                 // the line stops at "Now"; the locked plate is ahead of it
      const span = clamp((y - centers[0].y) / (centers[last].y - centers[0].y));
      ink.style.strokeDashoffset = len - len * (span * (centers.length - 2) / (centers.length - 1));
      let best = 0;
      centers.forEach((c, i) => {
        if (y >= c.y - 6) best = i;
        if (finals[i].state !== 'locked') setNode(i, y >= c.y - 40 ? finals[i].state : 'locked');
      });
      if (wide() && performance.now() - pinnedByClick > 1200 && b.top < innerHeight * .7 && b.bottom > innerHeight * .2) activate(best);
      if (span >= 1) award('path-end', 15);
    }

    window.__path = { scroll, layoutLine };
    if (calm) { finals.forEach((f, i) => setNode(i, f.state)); }
    else nodes.forEach((n, i) => { if (finals[i].state !== 'locked') { n.dataset.state = 'locked'; delete n.dataset.progress; delete n.dataset.rendered; } });
    B.renderNodes(col);
    B.layoutPath(col);
    activate(0);
    layoutLine();
    new ResizeObserver(layoutLine).observe(col);
  })();

  /* ── Project filter with a FLIP layout animation ── */
  (function work() {
    const cards = $$('#projects .project');
    Scenes.mount($('#projects'));
    $$('#workChips .chip').forEach(chip => chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      const first = new Map(cards.filter(c => !c.hidden).map(c => [c, c.getBoundingClientRect()]));
      cards.forEach(c => { c.hidden = f !== 'all' && !c.dataset.tags.split(' ').includes(f); c.classList.add('in'); });
      if (!calm) cards.filter(c => !c.hidden).forEach(c => {
        const a = first.get(c), z = c.getBoundingClientRect();
        if (!a) { c.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, 1.1, .36, 1)' }); return; }
        c.animate([{ transform: `translate(${a.left - z.left}px, ${a.top - z.top}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2, 1.1, .36, 1)' });
      });
      award('filter', 5);
      requestAnimationFrame(window.__measure);
    }));
  })();

  /* ── The stack: six plates that come apart as you scroll ── */
  const stack = (() => {
    const LAYERS = [
      { name: 'Agents and apps', hue: 'purple', what: 'Where a model becomes something people use.', tools: ['Agentic workflows', 'Model Context Protocol', 'LangChain', 'AnythingLLM', 'Flask', 'Prompt engineering'] },
      { name: 'Retrieval', hue: 'teal', what: 'Grounding answers in documents the model has never seen.', tools: ['RAG pipelines', 'ChromaDB', 'Document recovery'] },
      { name: 'Models and evaluation', hue: 'pink', what: 'Benchmarks that say whether a Kurdish model actually got better.', tools: ['Benchmark design', 'LLM fine-tuning support', 'Tokenization research', 'Hugging Face', 'OpenRouter', 'Vertex AI'] },
      { name: 'Data pipelines', hue: 'orange', what: 'Collecting, cleaning and structuring data before any model sees it.', tools: ['Python', 'Web scraping', 'Telethon', 'Async pipelines', 'Conda', 'Jupyter'] },
      { name: 'Serving and monitoring', hue: 'blue', what: 'Keeping inference fast, measured and sized for real load.', tools: ['vLLM', 'GPU infrastructure', 'Load testing', 'Prometheus', 'Grafana', 'Langfuse'] },
      { name: 'Servers and networks', hue: 'green', what: 'The on-premise base that keeps data in the building, and the telecom work I started on.', tools: ['Linux', 'Proxmox', 'Bash', 'Access control', 'Service isolation','Huawei NetEco', 'iMaster MAE', 'Nokia NetAct'] },
    ];
    const list = $('#stackList'), svg = $('#stackSvg'), pin = $('#stackPin');
    list.innerHTML = LAYERS.map((l, i) => `<button class="stack-item stack-item--${l.hue}" type="button" data-i="${i}" aria-pressed="false"><span class="stack-item__name">${l.name}</span><span class="stack-item__more"><span class="stack-item__inner"><span class="stack-item__what">${l.what}</span><span class="stack-item__tools">${l.tools.map(t => `<span class="badge badge--subtle badge--${l.hue}">${t}</span>`).join('')}</span></span></span></button>`).join('');

    const HW = 190, HH = 110, TH = 24;
    const rhomb = `M0 ${-HH} L${HW} 0 L0 ${HH} L${-HW} 0 Z`;
    const left = `M${-HW} 0 L0 ${HH} L0 ${HH + TH} L${-HW} ${TH} Z`, right = `M${HW} 0 L0 ${HH} L0 ${HH + TH} L${HW} ${TH} Z`;
    svg.innerHTML = LAYERS.slice().reverse().map((l, ri) => {
      const i = LAYERS.length - 1 - ri;
      return `<g class="plate" data-i="${i}" style="--hue-top: var(--${l.hue}-400); --hue-l: var(--${l.hue}-600); --hue-r: var(--${l.hue}-700)">
        <path class="plate__l" d="${left}"/><path class="plate__r" d="${right}"/><path class="plate__t" d="${rhomb}"/>
        <text class="plate__label" transform="matrix(.866 .5 -.866 .5 -68 36)" text-anchor="middle" dy=".35em">${l.name}</text></g>`;  // along the front edge, the part the plate above never covers
    }).join('');
    const plates = LAYERS.map((_, i) => $(`.plate[data-i="${i}"]`, svg));
    const items = $$('.stack-item', list);
    let active = -1, pinned = false;

    function setActive(i) {
      if (i === active) return;
      active = i;
      items.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', k === i); });
      plates.forEach((p, k) => p.classList.toggle('is-active', k === i));
    }
    function pose(spread, nudge) {
      const n = LAYERS.length, gap = 24 + 66 * spread;
      LAYERS.forEach((_, i) => {
        const y = 310 + (i - (n - 1) / 2) * gap;
        const on = i === active ? nudge : 0;
        plates[i].setAttribute('transform', `translate(${280 + on * 26} ${y})`);
      });
    }
    function scroll() {
      if (!pinned) return;
      const b = pin.getBoundingClientRect(), span = b.height - innerHeight;
      const p = clamp(-b.top / span);
      setActive(Math.min(LAYERS.length - 1, Math.floor(p * LAYERS.length)));
      pose(clamp(p * 5), 1);
      if (p > .98) award('stack-end', 10);
    }
    items.forEach((b, i) => b.addEventListener('click', () => {
      award('stack-' + i, 2);
      if (pinned) {
        const top = pin.getBoundingClientRect().top + scrollY, span = pin.offsetHeight - innerHeight;
        scrollTo({ top: top + (i + .5) / LAYERS.length * span, behavior: calm ? 'auto' : 'smooth' });
      } else { setActive(i); pose(1, 1); }
    }));
    function layout() {
      pinned = innerWidth >= 992 && !calm;
      pin.classList.toggle('is-pinned', pinned);
      if (!pinned) { setActive(active < 0 ? 0 : active); pose(1, 1); } else scroll();
    }
    setActive(0);
    layout();
    return { scroll, layout };
  })();

  /* ── Scroll-driven bits, all sharing one frame ── */
  const stmt = $('#statement');
  (function splitStatement() {
    const parts = [];
    stmt.childNodes.forEach(n => {
      const key = n.nodeType === 1;
      const band = key ? document.createElement('span') : null;   // one continuous marker band across the key words
      if (band) { band.className = 'keyband'; parts.push(band); }
      n.textContent.split(/(\s+)/).forEach(w => {
        if (!w) return;
        const add = node => (band ? band.append(node) : parts.push(node));
        if (/^\s+$/.test(w)) { add(document.createTextNode(' ')); return; }
        const s = document.createElement('span'); s.className = 'ink'; s.textContent = w; add(s);
      });
    });
    stmt.setAttribute('aria-label', stmt.textContent);
    stmt.replaceChildren(...parts);
  })();
  const inks = $$('.ink', stmt);

  const measure = () => onScroll();
  window.__measure = measure;

  let ticking = false;
  function onScroll() {
    ticking = false;
    if (!calm) {
      const r = stmt.getBoundingClientRect();
      const p = clamp((innerHeight * .86 - r.top) / (r.height + innerHeight * .34));
      const lit = p * inks.length * 1.08;
      inks.forEach((w, i) => w.style.opacity = .16 + .84 * clamp(lit - i));
      stmt.classList.toggle('is-lit', p > .9);
    }
    window.__path.scroll();
    stack.scroll();
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', () => { stack.layout(); measure(); });
  addEventListener('load', measure);
  document.fonts && document.fonts.ready.then(() => { measure(); window.__path.layoutLine(); });
  measure();

  /* ── Data boundaries: pick a kind of data, see where it may go ── */
  (function boundary() {
    // each line is a list of [text, mask]; masked parts are what redaction strips before anything leaves
    const KINDS = {
      public: {
        line: [['Help article: “How to reset your home router”']],
        plain: { go: { api: 'yes', cloud: 'yes', local: 'yes' }, best: 'api', title: 'Send it anywhere', text: "It's already public, so use the fastest, cheapest model that does the job well.", send: 'The article itself', keep: 'Nothing to hold back' },
      },
      policies: {
        line: [['HR policy draft: “Remote work rules, v3” · approved by '], ['R. Ali', '[NAME]']],
        plain: { go: { api: 'care', cloud: 'yes', local: 'yes' }, best: 'cloud', title: 'Keep it in your own tenant', text: 'Internal but not secret. A private deployment works, or an API with no-training and no-retention terms.', send: 'The policy text', keep: 'Names of the people behind decisions' },
        red: { go: { api: 'care', cloud: 'yes', local: 'yes' }, best: 'cloud', title: 'Names out, same answer', text: 'Removing names helps, but the policy is still internal. Keep it in your tenant, or use an API with strict terms.', send: 'The policy text', keep: 'Names, already removed' },
      },
      customers: {
        line: [['Ticket #'], ['4410-22', '[ID]'], [' · '], ['Dilan K.', '[NAME]'], [' · '], ['0750 000 0000', '[PHONE]'], [' · “My bill doubled this month”']],
        plain: { go: { api: 'no', cloud: 'care', local: 'yes' }, best: 'local', title: 'Keep it on-premise', text: 'This is personal data. Process it locally, or strip the identifiers before anything leaves.', send: 'Nothing yet', keep: 'Name, phone number, account ID' },
        red: { go: { api: 'care', cloud: 'yes', local: 'yes' }, best: 'cloud', title: 'Redacted, it can travel', text: 'With names, numbers and IDs replaced, the complaint is safe for a private deployment, and for an API with strict terms.', send: 'The complaint text', keep: 'Name, phone number, account ID' },
      },
      code: {
        line: [['config.py · DB_PASSWORD = '], ['"s3cr3t-prod"', '[SECRET]'], [' · def billing_rules():']],
        plain: { go: { api: 'no', cloud: 'care', local: 'yes' }, best: 'local', title: 'Strip the secrets first', text: 'Code often carries passwords and core business logic. Never send secrets, and keep the logic on infrastructure you control.', send: 'Nothing yet', keep: 'Passwords, keys, internal hostnames' },
        red: { go: { api: 'care', cloud: 'yes', local: 'yes' }, best: 'cloud', title: 'Secrets out, then a private deployment', text: 'With credentials removed, a private deployment is a sensible default. A public API only with terms your security team has read.', send: 'Code without credentials', keep: 'Passwords, keys, internal hostnames' },
      },
      finance: {
        line: [['Q3 results draft · revenue and margins · not yet announced']],
        plain: { go: { api: 'no', cloud: 'no', local: 'yes' }, best: 'local', title: "Don't let it leave", text: 'Unreleased results are market-sensitive. Run the model next to the data, and log every access.', send: 'Nothing outside the building', keep: 'All of it, until it is announced' },
      },
    };
    const BADGE = { yes: ['Yes', 'badge--green'], care: ['With care', 'badge--yellow'], no: ['No', ''] };
    const lineEl = $('#recordLine'), redact = $('#redact'), redactLabel = $('#redactLabel');
    const dests = $$('#dests .dest');
    let kind = 'customers', lastBest = null;

    function drawLine(k, masked, animate) {
      lineEl.replaceChildren(...KINDS[k].line.map(([text, mask]) => {
        const s = document.createElement('span');
        s.textContent = text;
        if (mask) { s.className = 'pii'; s.dataset.mask = mask; s.dataset.text = text; }
        return s;
      }));
      if (!masked) return;
      $$('.pii', lineEl).forEach(s => {
        if (!animate || calm) { s.textContent = s.dataset.mask; s.classList.add('is-masked'); return; }
        s.classList.add('is-sweeping');
        setTimeout(() => { s.classList.remove('is-sweeping'); s.textContent = s.dataset.mask; s.classList.add('is-masked'); }, 380);
      });
    }

    function render(animate = true) {
      const K = KINDS[kind], canRedact = !!K.red;
      redact.disabled = !canRedact;
      if (!canRedact) redact.checked = false;
      redactLabel.classList.toggle('is-off', !canRedact);
      const v = redact.checked ? K.red : K.plain;
      drawLine(kind, redact.checked, animate);
      dests.forEach(d => {
        const g = v.go[d.dataset.dest], node = $('.lesson-node', d), badge = $('.dest__badge', d);
        const st = g === 'yes' ? 'done' : g === 'care' ? 'current' : 'locked';
        if (node.dataset.state !== st) {
          node.dataset.state = st;
          node.dataset.progress = st === 'done' ? 2 : st === 'current' ? 1 : 0;
          delete node.dataset.rendered;
        }
        badge.textContent = BADGE[g][0];
        badge.className = 'badge badge--subtle dest__badge ' + BADGE[g][1];
        d.classList.toggle('dest--best', d.dataset.dest === v.best);
        d.classList.toggle('dest--no', g === 'no');
      });
      B.renderNodes($('#dests'));
      $('#bvTitle').textContent = v.title;
      $('#bvText').textContent = v.text;
      $('#bvSend').textContent = v.send;
      $('#bvKeep').textContent = v.keep;
      if (animate && !calm && v.best !== lastBest) flyTo($(`.dest[data-dest="${v.best}"]`));
      lastBest = v.best;
    }

    // a small packet leaves the record and lands on the best destination
    function flyTo(dest) {
      const a = lineEl.getBoundingClientRect(), b = $('.lesson-node', dest).getBoundingClientRect();
      const p = document.createElement('span');
      p.className = 'packet';
      document.body.append(p);
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height * .55;
      p.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1)`, opacity: 1, offset: .5 },
        { transform: `translate(${x1}px, ${y1}px) scale(.5)`, opacity: .9 },
      ], { duration: 720, easing: 'cubic-bezier(.3, .7, .3, 1)' }).onfinish = () => {
        p.remove();
        $('.lesson-node', dest).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: .4 }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.2, 1.1, .36, 1)' });
      };
    }

    $$('#dataChips .chip').forEach(c => c.addEventListener('click', () => { kind = c.dataset.kind; render(); award('data-' + kind, 5); }));
    redact.addEventListener('change', () => { render(); B.sfx.toggle(); award('redact', 10); });
    render(false);
  })();

  /* ── The quiz, a small lesson with a glowing feedback sheet ── */
  (function quiz() {
    const steps = $$('.quiz__step'), segs = $$('#quizSteps .steps__seg'), check = $('#quizCheck'), fb = $('#feedback');
    let at = 0, picked = null;
    const setBtn = (el, cls, label) => { el.className = 'btn3d btn3d--block ' + cls; $('.btn3d__face', el).textContent = label; };

    const quizBox = $('#quiz');
    function closeFb() { fb.hidden = true; $('#quizFoot').style.visibility = ''; }
    function show(ok, text, onCont) {
      fb.className = 'feedback ' + (ok ? 'feedback--correct' : 'feedback--incorrect');
      $('#fbTitle').innerHTML = ok ? '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check"/></svg>Correct!' : 'Not quite';
      $('#fbText').textContent = text;
      const acts = $('#fbActions');
      acts.replaceChildren();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="btn3d__face"></span>';
      setBtn(btn, ok ? 'btn3d--green' : '', ok ? 'Continue' : 'Try again');
      btn.addEventListener('click', onCont);
      acts.append(btn);
      fb.hidden = false;
      $('#quizFoot').style.visibility = 'hidden';
      // keep the question and the chosen answer clear of the sheet
      const top = quizBox.getBoundingClientRect().top + scrollY - 96;
      if (quizBox.getBoundingClientRect().bottom > innerHeight - fb.offsetHeight) scrollTo({ top, behavior: calm ? 'auto' : 'smooth' });
      btn.focus({ preventScroll: true });
    }

    steps.forEach(s => s.addEventListener('choice', e => {
      picked = e.detail;
      if (check.disabled) { check.disabled = false; B.sfx.unlock(); }
    }));
    check.addEventListener('click', () => {
      if (!picked) return;
      const step = steps[at], choices = $$('.choice', step);
      const ok = choices.indexOf(picked) === +step.dataset.answer;
      if (ok) {
        picked.dataset.state = 'correct';
        choices.forEach(c => c.disabled = true);
        B.sfx.correct();
        segs[at].className = 'steps__seg steps__seg--correct';
        award('q' + at, 25);
        show(true, $('.t-right', step).innerHTML, next);
      } else {
        picked.dataset.state = 'incorrect';
        B.sfx.wrong();
        show(false, $('.t-wrong', step).innerHTML, () => {
          closeFb();
          choices.forEach(c => { c.setAttribute('aria-checked', 'false'); c.removeAttribute('data-state'); });
          picked = null; check.disabled = true;
          choices[0].focus({ preventScroll: true });
        });
      }
    });
    function next() {
      closeFb();
      steps[at].hidden = true;
      at++;
      picked = null;
      check.disabled = true;
      if (at < steps.length) {
        steps[at].hidden = false;
        steps[at].classList.add('anim-slide-up');
        segs[at].classList.add('steps__seg--current');
        return;
      }
      $('#quizFoot').innerHTML = '<a class="btn3d btn3d--wide btn3d--blue" href="#contact"><span class="btn3d__face">Finish</span></a>';
      $('#quizDone').hidden = false;
      B.sfx.complete();
      requestAnimationFrame(window.__measure);
      $('#quizDone').scrollIntoView({ block: 'center', behavior: 'instant' });
      if (!calm) confetti($('.coin'));
    }
    function confetti(from) {
      const b = from.getBoundingClientRect();
      const hues = ['blue', 'pink', 'teal', 'orange', 'purple', 'pear'];
      for (let i = 0; i < 34; i++) {
        const p = document.createElement('span');
        p.className = 'plate-bit';
        p.style.cssText = `left:${b.left + b.width / 2}px; top:${b.top + b.height / 2}px; background: var(--${hues[i % 6]}-400); box-shadow: 0 3px 0 var(--${hues[i % 6]}-600)`;
        document.body.append(p);
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
        p.animate([
          { transform: 'translate(-50%, -50%) rotate(45deg) scale(1, .58)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 90}px) rotate(${135 + Math.random() * 180}deg) scale(1, .58)`, opacity: 1, offset: .62 },
          { transform: `translate(${Math.cos(a) * d * 1.12}px, ${Math.sin(a) * d + 210}px) rotate(${240 + Math.random() * 180}deg) scale(1, .58)`, opacity: 0 },
        ], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(.2, .7, .4, 1)' }).onfinish = () => p.remove();
      }
    }
  })();

  /* ── Contact band ── */
  (function contact() {
    const words = $$('#greeting .greeting__w');
    let i = 0;
    words[0].classList.add('on');
    if (!calm) setInterval(() => { words[i].classList.remove('on'); i = (i + 1) % words.length; words[i].classList.add('on'); }, 1900);
    $('#copyEmail').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('sawabsarkavri@proton.me'); toast('Address copied'); B.sfx.select(); }
      catch (e) { toast("Couldn't copy. The address is sawabsarkavri@proton.me"); }
      award('copy', 10);
    });
    const clock = $('#clock');
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' });
    const tick = () => { clock.textContent = ' · ' + fmt.format(new Date()) + ' local time'; };
    tick(); setInterval(tick, 20000);
  })();
})();
