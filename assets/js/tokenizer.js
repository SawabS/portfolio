/* A real byte-pair-encoding (BPE) tokenizer that trains in the browser, plus the
 * tile view that animates its merges. Letters are left unjoined until a merge
 * connects them, so Arabic-script text visibly knits itself back together. */
window.Tok = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const HUES = ['blue', 'purple', 'teal', 'orange', 'pink', 'papaya', 'green'];

  const SAMPLES = {
    bahdini: {
      show: 'ئەز ب کوردی دئاخڤم', gloss: '“I speak Kurdish”, in Bahdini', target: 'کوردی',
      corpus: ['ئەز ب کوردی دئاخڤم', 'تو ب کوردی دئاخڤی', 'ئەم ب کوردی دخوینین', 'ئەز کوردی دخوینم', 'ئەو ب کوردی دنڤیسیت', 'زمانێ مە کوردی یە'],
    },
    sorani: {
      show: 'من بە کوردی قسە دەکەم', gloss: '“I speak Kurdish”, in Sorani', target: 'کوردی',
      corpus: ['من بە کوردی قسە دەکەم', 'تۆ بە کوردی قسە دەکەیت', 'ئێمە بە کوردی دەخوێنین', 'من کوردی دەخوێنم', 'ئەو بە کوردی دەنووسێت', 'زمانی ئێمە کوردییە'],
    },
    english: {
      show: 'I speak Kurdish', gloss: 'The same sentence in English', target: 'Kurdish',
      corpus: ['I speak Kurdish', 'You speak Kurdish', 'We read Kurdish', 'I read Kurdish', 'They write in Kurdish', 'Our language is Kurdish'],
    },
  };

  const units = (word, mode) => mode === 'bytes' ? Array.from(encoder.encode(word), b => String.fromCharCode(b)) : Array.from(word);
  const wordsOf = text => text.trim().split(/\s+/).filter(Boolean);

  function train(lines, mode) {
    const freq = new Map();
    lines.forEach(l => wordsOf(l).forEach(w => freq.set(w, (freq.get(w) || 0) + 1)));
    const words = Array.from(freq, ([w, f]) => ({ syms: units(w, mode), f }));
    const base = new Set();
    words.forEach(w => w.syms.forEach(s => base.add(s)));
    const total = () => words.reduce((n, w) => n + w.syms.length * w.f, 0);
    const merges = [], curve = [total()];
    while (merges.length < 400) {
      const counts = new Map();
      words.forEach(w => { for (let i = 0; i < w.syms.length - 1; i++) { const k = w.syms[i] + '\0' + w.syms[i + 1]; counts.set(k, (counts.get(k) || 0) + w.f); } });
      let best = null, top = 0;
      counts.forEach((n, k) => { if (n > top) { top = n; best = k; } });  // first seen wins ties, so training is deterministic
      if (!best) break;
      const [a, b] = best.split('\0');
      merges.push({ a, b, n: top });
      words.forEach(w => { w.syms = applyMerge(w.syms, a, b); });
      curve.push(total());
    }
    return { merges, curve, vocabBase: base.size, mode };
  }

  function applyMerge(syms, a, b) {
    const out = [];
    for (let i = 0; i < syms.length; i++) {
      if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) { out.push(a + b); i++; }
      else out.push(syms[i]);
    }
    return out;
  }

  /** The sentence as an array of words, each an array of tokens, after k merges. */
  function segment(text, model, k) {
    return wordsOf(text).map(w => {
      let syms = units(w, model.mode);
      for (let i = 0; i < k && i < model.merges.length; i++) syms = applyMerge(syms, model.merges[i].a, model.merges[i].b);
      return syms;
    });
  }

  /** How a token reads on screen. Partial UTF-8 sequences show as hex, as a model would hold them. */
  function label(sym, mode) {
    if (mode !== 'bytes') return { text: sym, hex: false };
    const bytes = Uint8Array.from(sym, c => c.charCodeAt(0));
    try { return { text: decoder.decode(bytes), hex: false }; }
    catch (e) { return { text: Array.from(bytes, b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), hex: true }; }
  }

  function hueOf(sym) {
    let h = 0;
    for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
  }

  /** First merge count at which `word` is a single token, or -1. */
  function mergesToJoin(word, model) {
    for (let k = 0; k <= model.merges.length; k++) if (segment(word, model, k)[0].length === 1) return k;
    return -1;
  }

  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Renders tokens as tiles. Each new tile animates from where its letters just were. */
  class View {
    constructor(el) { this.el = el; }
    render(words, mode, { animate = true } = {}) {
      const old = [];
      if (animate && !calm()) this.el.querySelectorAll('.tile').forEach(t => {
        const [w, s, e] = t.dataset.k.split(':').map(Number);
        old.push({ w, s, e, r: t.getBoundingClientRect() });
      });
      const frag = document.createDocumentFragment();
      words.forEach((syms, wi) => {
        const group = document.createElement('span');
        group.className = 'tiles__word';
        let at = 0;
        syms.forEach(sym => {
          const len = mode === 'bytes' ? sym.length : Array.from(sym).length;
          const { text, hex } = label(sym, mode);
          const tile = document.createElement('span');
          const merged = len > 1;
          tile.className = 'tile' + (merged ? ' tile--merged tile--' + hueOf(sym) : '') + (hex ? ' tile--hex' : '');
          tile.textContent = text;
          tile.dataset.k = `${wi}:${at}:${at + len}`;
          group.append(tile);
          at += len;
        });
        frag.append(group);
      });
      this.el.replaceChildren(frag);
      if (!old.length) return;
      this.el.querySelectorAll('.tile').forEach(t => {
        const [w, s, e] = t.dataset.k.split(':').map(Number);
        const from = old.filter(o => o.w === w && o.s < e && o.e > s);
        if (!from.length) return;
        const left = Math.min(...from.map(o => o.r.left)), top = Math.min(...from.map(o => o.r.top));
        const right = Math.max(...from.map(o => o.r.right)), bottom = Math.max(...from.map(o => o.r.bottom));
        const r = t.getBoundingClientRect();
        if (!r.width) return;
        const dx = left - r.left, dy = top - r.top, sx = (right - left) / r.width, sy = (bottom - top) / r.height;
        const joined = from.length > 1;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(sx - 1) < .01 && !joined) return;
        t.animate([
          { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transformOrigin: '0 0', transform: 'none' },
        ], { duration: joined ? 420 : 320, easing: 'cubic-bezier(.2, 1.1, .36, 1)' });
        if (joined) t.classList.add('tile--pop');
      });
    }
  }

  return { SAMPLES, train, segment, label, mergesToJoin, View, wordsOf };
})();
