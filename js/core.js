'use strict';
/* ===== Общие утилиты, состояние, ассистентка, реестр миссий ===== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const fmt = (v, d = 0) => Number(v).toFixed(d);

/** Детерминированный генератор случайных чисел */
function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.gauss = () => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return f;
}
const R = rng(Date.now() % 1e9);
function shuffle(arr, r = R) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Область жизни: всё, что зарегистрировано, снимается при dispose() */
class Scope {
  constructor() { this.fns = []; this.alive = true; this.keys = {}; this._keys = false; }
  on(target, evt, fn, opts) { target.addEventListener(evt, fn, opts); this.fns.push(() => target.removeEventListener(evt, fn, opts)); }
  raf(fn) {
    let last = performance.now(), id = 0, stopped = false;
    const step = (t) => {
      if (!this.alive || stopped) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (fn(dt, t) === false) { stopped = true; return; }
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    const stop = () => { stopped = true; cancelAnimationFrame(id); };
    this.fns.push(stop);
    return stop;
  }
  timeout(fn, ms) { const id = setTimeout(() => this.alive && fn(), ms); this.fns.push(() => clearTimeout(id)); return id; }
  interval(fn, ms) { const id = setInterval(() => this.alive && fn(), ms); this.fns.push(() => clearInterval(id)); return id; }
  trackKeys() {
    if (this._keys) return this.keys;
    this._keys = true;
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    this.on(window, 'keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys[e.code] = true;
      if (block.includes(e.code)) e.preventDefault();
    });
    this.on(window, 'keyup', (e) => { this.keys[e.code] = false; });
    this.on(window, 'blur', () => { for (const k in this.keys) this.keys[k] = false; });
    return this.keys;
  }
  dispose() { this.alive = false; this.fns.forEach((f) => { try { f(); } catch (e) { /* noop */ } }); this.fns = []; }
}

/** Экранные кнопки для сенсорных устройств: эмулируют клавиши */
function touchControls(scope, groups) {
  const wrap = h('<div class="touch-pad"></div>');
  for (const g of groups) {
    const grp = h('<div class="touch-group"></div>');
    for (const b of g) {
      const btn = h(`<button class="touch-btn" type="button">${b.label}</button>`);
      if (b.wide) btn.classList.add('wide');
      const down = (e) => { e.preventDefault(); btn.classList.add('on'); window.dispatchEvent(new KeyboardEvent('keydown', { code: b.code, key: b.code })); };
      const up = (e) => { e.preventDefault(); if (!btn.classList.contains('on')) return; btn.classList.remove('on'); window.dispatchEvent(new KeyboardEvent('keyup', { code: b.code, key: b.code })); };
      scope.on(btn, 'pointerdown', down);
      scope.on(btn, 'pointerup', up);
      scope.on(btn, 'pointerleave', up);
      scope.on(btn, 'pointercancel', up);
      grp.appendChild(btn);
    }
    wrap.appendChild(grp);
  }
  return wrap;
}

/** Координаты указателя в системе координат canvas */
function canvasPoint(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}

/* ===== Сохранение ===== */
const Store = {
  key: 'space-missions-v1',
  data: { name: '', role: null, best: {} },
  load() { try { const s = JSON.parse(localStorage.getItem(this.key)); if (s) this.data = Object.assign(this.data, s); } catch (e) { /* noop */ } return this.data; },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* noop */ } },
  reset() { this.data = { name: '', role: null, best: {} }; try { localStorage.removeItem(this.key); } catch (e) { /* noop */ } },
};
const starsFor = (score) => (score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0);
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

/* ===== Ассистентка ===== */
const ASSISTANT = { name: 'Эмили Картер', title: 'координатор миссий' };
const AVATAR_SVG = `
<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
  <defs>
    <radialGradient id="avbg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#2b4f8a"/><stop offset="1" stop-color="#0d1730"/></radialGradient>
    <linearGradient id="avhair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3420"/><stop offset="1" stop-color="#3a2014"/></linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#avbg)"/>
  <path d="M28 64 C24 30 44 18 60 18 C80 18 98 30 92 70 L92 96 L28 96 Z" fill="url(#avhair)"/>
  <path d="M22 120 C24 96 40 88 60 88 C80 88 96 96 98 120 Z" fill="#1d3f7a"/>
  <path d="M48 88 L60 104 L72 88 Z" fill="#e9eef7"/>
  <rect x="52" y="74" width="16" height="16" rx="6" fill="#e9b48f"/>
  <ellipse cx="60" cy="56" rx="21" ry="25" fill="#f2c4a0"/>
  <path d="M38 52 C40 30 58 28 66 30 C76 32 84 40 82 54 C76 42 62 38 50 42 C44 44 40 48 38 52 Z" fill="url(#avhair)"/>
  <ellipse cx="51.5" cy="57" rx="2.6" ry="3.2" fill="#2a1a12"/>
  <ellipse cx="68.5" cy="57" rx="2.6" ry="3.2" fill="#2a1a12"/>
  <path d="M47 50 Q51.5 47.5 56 50" stroke="#3a2014" stroke-width="1.6" fill="none"/>
  <path d="M64 50 Q68.5 47.5 73 50" stroke="#3a2014" stroke-width="1.6" fill="none"/>
  <path d="M60 60 L58 66 L61 66" stroke="#d49a78" stroke-width="1.4" fill="none"/>
  <path d="M53 71 Q60 76 67 71" stroke="#b5524a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="46" cy="65" rx="4" ry="2.4" fill="#f0a08a" opacity=".45"/>
  <ellipse cx="74" cy="65" rx="4" ry="2.4" fill="#f0a08a" opacity=".45"/>
  <path d="M36 56 C34 38 46 28 60 28 C74 28 86 38 84 56" stroke="#1b1f2a" stroke-width="3.5" fill="none"/>
  <rect x="32" y="52" width="8" height="14" rx="3" fill="#1b1f2a"/>
  <path d="M36 66 C38 76 46 78 52 76" stroke="#1b1f2a" stroke-width="2" fill="none"/>
  <circle cx="53" cy="76" r="2.4" fill="#1b1f2a"/>
  <circle cx="84" cy="102" r="6" fill="#d8dde8"/><path d="M80 102 h8 M84 98 v8" stroke="#1d3f7a" stroke-width="1.6"/>
</svg>`;

/** Диалог с ассистенткой. lines: строки (можно HTML). Возвращает Promise, завершается после последней реплики */
function talk(container, lines, opts = {}) {
  return new Promise((resolve) => {
    const box = h(`
      <div class="dialog">
        <div class="avatar">${AVATAR_SVG}</div>
        <div class="bubble">
          <div class="speaker">${ASSISTANT.name} <span>· ${ASSISTANT.title}</span></div>
          <div class="speech"></div>
          <div class="dialog-actions"><button class="btn btn-primary next" type="button">Далее ▸</button></div>
        </div>
      </div>`);
    container.appendChild(box);
    const speech = $('.speech', box);
    const next = $('.next', box);
    let i = 0, typing = null, full = '';
    const show = () => {
      full = lines[i];
      const plain = full.replace(/<[^>]+>/g, '');
      let n = 0;
      speech.textContent = '';
      clearInterval(typing);
      typing = setInterval(() => {
        n += 2;
        if (n >= plain.length) { clearInterval(typing); typing = null; speech.innerHTML = full; return; }
        speech.textContent = plain.slice(0, n);
      }, 16);
      next.textContent = i === lines.length - 1 ? (opts.lastLabel || 'Понятно ✓') : 'Далее ▸';
    };
    const advance = () => {
      if (typing) { clearInterval(typing); typing = null; speech.innerHTML = full; return; }
      i++;
      if (i >= lines.length) {
        if (opts.keep) { next.remove(); } else { box.remove(); }
        resolve();
        return;
      }
      show();
    };
    next.addEventListener('click', advance);
    show();
  });
}

/** Короткая подсказка ассистентки внутри миссии */
function hintBox(text) {
  return h(`<div class="hint"><div class="mini-avatar">${AVATAR_SVG}</div><div class="hint-text">${text}</div></div>`);
}

/* ===== Реестр миссий ===== */
const Missions = {
  list: [],
  register(m) { this.list.push(m); },
  get(id) { return this.list.find((m) => m.id === id); },
};
const CATEGORIES = {
  orbit: { title: '🛰 Околоземная орбита', sub: 'МКС, Тяньгун' },
  moon: { title: '🌕 Полёты к Луне', sub: 'Artemis и разведка южного полюса' },
  mars: { title: '🔴 Полёты к Марсу', sub: 'Пока туда летают только роботы' },
};
const ROLES = {
  pilot: { title: 'Пилот', icon: '👨‍🚀', desc: 'Участвует в миссиях, которые требуют личного присутствия: выходы в открытый космос, испытательные полёты, высадка и работа на Луне.' },
  scientist: { title: 'Учёный', icon: '🔬', desc: 'Работает над удалёнными миссиями: наблюдение Земли, управление спутниками, съёмка Луны, орбитальные аппараты и марсоходы.' },
};

/* ===== Звёздный фон ===== */
(function starfield() {
  const c = document.getElementById('stars');
  if (!c) return;
  const ctx = c.getContext('2d');
  let stars = [];
  const resize = () => {
    c.width = innerWidth; c.height = innerHeight;
    stars = Array.from({ length: Math.round((c.width * c.height) / 5000) }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.4 + 0.2, p: Math.random() * 6.28, s: 0.3 + Math.random() * 1.2,
    }));
  };
  resize();
  addEventListener('resize', resize);
  const draw = (t) => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of stars) {
      const a = 0.45 + 0.45 * Math.sin(s.p + t * 0.001 * s.s);
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();
