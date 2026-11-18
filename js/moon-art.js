'use strict';
/* Общая графика Луны: процедурная поверхность и кратеры (нужна миссиям «Фотосъёмка» и «Высадка») */
(function () {
  /** Процедурная текстура лунной поверхности */
  function moonTexture(w, h, seed, extraCraters) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const r = rng(seed);
    x.fillStyle = '#7d7b78'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 900; i++) { const g = 100 + r() * 60; x.fillStyle = `rgba(${g},${g},${g - 4},0.25)`; x.fillRect(r() * w, r() * h, r() * 14 + 2, r() * 14 + 2); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(60,60,62,.25)'; x.beginPath(); x.ellipse(r() * w, r() * h, r.range(80, 260), r.range(60, 180), r() * 3, 0, 7); x.fill(); }
    const craters = [];
    for (let i = 0; i < w * h / 5200; i++) craters.push([r() * w, r() * h, Math.pow(r(), 4.5) * 46 + 1.5]);
    (extraCraters || []).forEach((cc) => craters.push(cc));
    craters.forEach(([cx, cy, rr]) => drawCrater(x, cx, cy, rr));
    return c;
  }
  function drawCrater(x, cx, cy, rr) {
    // Солнце низко с востока: тень с западной стороны
    const g = x.createRadialGradient(cx + rr * 0.35, cy, rr * 0.2, cx, cy, rr);
    g.addColorStop(0, 'rgba(25,25,28,0.9)'); g.addColorStop(0.75, 'rgba(60,60,62,0.6)'); g.addColorStop(1, 'rgba(60,60,62,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fill();
    x.strokeStyle = 'rgba(210,208,200,.55)'; x.lineWidth = Math.max(1, rr * 0.12);
    x.beginPath(); x.arc(cx, cy, rr * 0.92, -Math.PI / 2 - 0.9, Math.PI / 2 + 0.9, true); x.stroke();
  }

  window.MoonArt = { moonTexture, drawCrater };
})();
