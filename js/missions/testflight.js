'use strict';
/* Миссия 4. Испытательный полёт: старт, система жизнеобеспечения, разгон к Луне, вход в атмосферу */
(function () {
  const W = 960, H = 480;
  const STEPS = ['Старт', 'Жизнеобеспечение', 'Разгон к Луне', 'Возвращение'];

  function start(root, api) {
    const S = api.scope;
    const keys = S.trackKeys();
    const scores = [];
    const details = [];
    const header = (i, title) => `<div class="stage-title"><h3>${title}</h3><div class="steps">${STEPS.map((t, k) => `<span class="step ${k < i ? 'done' : k === i ? 'on' : ''}">${t}</span>`).join('')}</div></div>`;
    const next = (fn) => S.timeout(fn, 1500);

    /* ---------- 1. Старт и прохождение Max-Q ---------- */
    function launch() {
      root.innerHTML = '';
      const el = h(`<div>${header(0, 'Этап 1: старт ракеты SLS')}
        <canvas class="game-canvas" width="${W}" height="${H}"></canvas>
        <div class="card row"><span>Тяга двигателей</span><input type="range" min="40" max="100" value="100" class="thr" style="flex:1"><b class="thrv">100%</b></div></div>`);
      root.appendChild(el);
      el.appendChild(touchControls(S, [[{ label: '▲ тяга', code: 'ArrowUp', wide: true }, { label: '▼ тяга', code: 'ArrowDown', wide: true }], [{ label: 'Отделение', code: 'Space', wide: true }]]));
      api.hint('Самый опасный участок старта — зона максимального скоростного напора (Max-Q). Держите напор ниже красной линии 32 кПа: сбавляйте тягу в плотных слоях атмосферы и прибавляйте выше. Цель — 45 км как можно быстрее.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const thr = $('.thr', el), thrv = $('.thrv', el);
      const s = { h: 0, v: 0, t: 0, stress: 0, qmax: 0, phase: 'count', cd: 3, sepT: 0, qHist: [] };
      const QLIM = 32;
      S.on(window, 'keydown', (e) => {
        if (e.code === 'Space' && s.phase === 'sep') { s.phase = 'done'; finishLaunch(s.sepT); }
      });
      const finishLaunch = (react) => {
        const timeScore = clamp(100 - (s.t - 80) * 2, 0, 100);
        const qScore = clamp(100 - s.stress * 0.6, 0, 100);
        const sepScore = react == null ? 20 : clamp(100 - react * 25, 30, 100);
        const sc = s.stress > 250 ? 0 : timeScore * 0.35 + qScore * 0.45 + sepScore * 0.2;
        scores.push(sc);
        details.push(s.stress > 250 ? '<span class="bad">Старт: перегрузка конструкции, сработала система аварийного спасения</span>'
          : `Старт: 45 км за ${fmt(s.t, 0)} с, пиковый напор ${fmt(s.qmax, 1)} кПа (лимит ${QLIM}), отделение ускорителей ${react == null ? 'автоматически' : `через ${fmt(react, 2)} с`}`);
        api.hint(s.stress > 250 ? 'Конструкция не выдержала напора — капсула спасена системой САС. Продолжим испытания на резервном корабле.' : 'Ускорители отделены! Выходим на орбиту. Отличная работа.');
        next(lifeSupport);
      };
      S.raf((dt) => {
        if (s.phase === 'count') { s.cd -= dt; if (s.cd <= 0) s.phase = 'fly'; }
        if (keys.ArrowUp) thr.value = Math.min(100, +thr.value + 60 * dt);
        if (keys.ArrowDown) thr.value = Math.max(40, +thr.value - 60 * dt);
        thrv.textContent = `${Math.round(+thr.value)}%`;
        if (s.phase === 'fly') {
          const sdt = dt * 2.5;
          const a = (+thr.value / 100) * 30 - 9.8;
          s.v = Math.max(0, s.v + a * sdt); s.h += s.v * sdt; s.t += sdt;
          const q = (0.5 * 1.225 * Math.exp(-s.h / 8500) * s.v * s.v) / 1000;
          s.q = q; s.qmax = Math.max(s.qmax, q);
          if (q > QLIM) s.stress += (q - QLIM) * sdt;
          s.qHist.push(q);
          if (s.stress > 250) { s.phase = 'done'; finishLaunch(null); }
          if (s.h >= 45000) { s.phase = 'sep'; s.sepT = 0; }
        } else if (s.phase === 'sep') {
          s.sepT += dt; if (s.sepT > 4) { s.phase = 'done'; finishLaunch(null); }
        }
        drawLaunch(ctx, s, +thr.value, QLIM);
        return s.phase !== 'done' || undefined;
      });
    }
    function drawLaunch(ctx, s, thr, QLIM) {
      const k = clamp(s.h / 60000, 0, 1);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgb(${lerp(70, 2, k)},${lerp(140, 4, k)},${lerp(230, 15, k)})`);
      g.addColorStop(1, `rgb(${lerp(170, 10, k)},${lerp(210, 20, k)},${lerp(255, 50, k)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (k > 0.4) { ctx.fillStyle = `rgba(255,255,255,${(k - 0.4) * 1.5})`; for (let i = 0; i < 60; i++) ctx.fillRect((i * 137) % W, (i * 71) % H, 1.5, 1.5); }
      const gy = 400 + s.h / 8;
      if (gy < H + 50) { ctx.fillStyle = '#2f5a2a'; ctx.fillRect(0, gy, W, H); ctx.fillStyle = '#777'; ctx.fillRect(300, gy - 120, 20, 120); }
      // облака
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 5; i++) { const cy = 300 + i * 90 - (s.h / 10) % 900 + 450; if (s.h < 15000) { ctx.beginPath(); ctx.ellipse((i * 260) % W, (cy % 900) - 100, 90, 20, 0, 0, 7); ctx.fill(); } }
      // ракета
      const rx = 400, ry = 210;
      if (s.phase === 'fly' || s.phase === 'sep') {
        const fl = 40 + thr * 0.8 + Math.random() * 15;
        const fg = ctx.createLinearGradient(0, ry + 120, 0, ry + 120 + fl);
        fg.addColorStop(0, '#fff6c0'); fg.addColorStop(0.4, '#ffb030'); fg.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.moveTo(rx - 14, ry + 120); ctx.lineTo(rx + 14, ry + 120); ctx.lineTo(rx, ry + 120 + fl); ctx.fill();
        if (s.phase !== 'done') { [-26, 26].forEach((dx) => { ctx.beginPath(); ctx.moveTo(rx + dx - 7, ry + 115); ctx.lineTo(rx + dx + 7, ry + 115); ctx.lineTo(rx + dx, ry + 115 + fl * 1.1); ctx.fill(); }); }
      }
      ctx.fillStyle = '#e88a2a'; ctx.fillRect(rx - 14, ry, 28, 120);
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(rx - 33, ry + 20, 12, 95); ctx.fillRect(rx + 21, ry + 20, 12, 95);
      ctx.beginPath(); ctx.moveTo(rx - 33, ry + 20); ctx.lineTo(rx - 27, ry + 5); ctx.lineTo(rx - 21, ry + 20); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx + 21, ry + 20); ctx.lineTo(rx + 27, ry + 5); ctx.lineTo(rx + 33, ry + 20); ctx.fill();
      ctx.fillStyle = '#ddd'; ctx.fillRect(rx - 10, ry - 22, 20, 22);
      ctx.beginPath(); ctx.moveTo(rx - 10, ry - 22); ctx.lineTo(rx, ry - 44); ctx.lineTo(rx + 10, ry - 22); ctx.fill();
      // HUD
      ctx.fillStyle = 'rgba(0,8,20,.7)'; ctx.fillRect(560, 14, 386, 200);
      ctx.fillStyle = '#fff'; ctx.font = '15px "Exo 2"'; ctx.textAlign = 'left';
      ctx.fillText(`Высота: ${fmt(s.h / 1000, 1)} км / 45 км`, 576, 40);
      ctx.fillText(`Скорость: ${fmt(s.v, 0)} м/с`, 576, 62);
      ctx.fillText(`Время: T+${fmt(s.t, 0)} c`, 576, 84);
      const q = s.q || 0;
      ctx.fillText('Скоростной напор:', 576, 110);
      ctx.fillStyle = '#222'; ctx.fillRect(576, 118, 350, 16);
      ctx.fillStyle = q > QLIM ? '#ff5d6c' : '#4fe08a'; ctx.fillRect(576, 118, clamp(q / 60, 0, 1) * 350, 16);
      ctx.fillStyle = '#ff5d6c'; ctx.fillRect(576 + (QLIM / 60) * 350, 114, 2, 24);
      ctx.fillStyle = '#fff'; ctx.fillText(`${fmt(q, 1)} кПа`, 830, 110);
      ctx.fillText(`Нагрузка на конструкцию: ${fmt(Math.min(100, s.stress / 2.5), 0)}%`, 576, 160);
      ctx.fillStyle = '#222'; ctx.fillRect(576, 168, 350, 10); ctx.fillStyle = '#ffb547'; ctx.fillRect(576, 168, clamp(s.stress / 250, 0, 1) * 350, 10);
      // график напора
      ctx.strokeStyle = '#7cf0d0'; ctx.lineWidth = 1.5; ctx.beginPath();
      const n = s.qHist.length;
      s.qHist.forEach((v, i) => { const x = 576 + (i / Math.max(1, n)) * 350, y = 205 - clamp(v / 60, 0, 1) * 22; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.textAlign = 'center';
      if (s.phase === 'count') { ctx.font = 'bold 72px "Exo 2"'; ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(s.cd), W / 2, 120); }
      if (s.phase === 'sep') { ctx.fillStyle = 'rgba(80,10,10,.85)'; ctx.fillRect(W / 2 - 280, 400, 560, 50); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px "Exo 2"'; ctx.fillText('Ускорители выгорели! ПРОБЕЛ — отделить', W / 2, 432); }
    }

    /* ---------- 2. Система жизнеобеспечения ---------- */
    function lifeSupport() {
      root.innerHTML = '';
      const P = [
        { id: 'o2', name: 'Кислород (O₂)', unit: 'кПа', a: 16.5, b: 0.09, d: 2, ctrl: 'Подача O₂', sign: 1 },
        { id: 'co2', name: 'Углекислый газ (CO₂)', unit: 'мм рт. ст.', a: 0, b: 0.09, d: 2, ctrl: 'Мощность скруббера', sign: -1 },
        { id: 't', name: 'Температура', unit: '°C', a: 10, b: 0.25, d: 1, ctrl: 'Нагрев/охлаждение', sign: 1 },
        { id: 'hum', name: 'Влажность', unit: '%', a: 0, b: 1.0, d: 0, ctrl: 'Осушитель', sign: -1 },
      ];
      const el = h(`<div>${header(1, 'Этап 2: проверка жизнеобеспечения корабля Orion')}
        <div class="card small">На борту четыре астронавта. Удерживайте все показатели в зелёной зоне. Нагрузка меняется: экипаж двигается, работает техника. Осталось: <b class="left">40</b> с</div>
        <div class="grid-2">${P.map((p) => `<div class="card" data-p="${p.id}"><h4>${p.name}</h4>
          <p class="big-val"><b class="val">—</b> ${p.unit} <span class="small muted">норма ${fmt(p.a + p.b * 35, p.d)}–${fmt(p.a + p.b * 65, p.d)}</span></p>
          <div class="meter" style="height:18px"><div class="zone" style="left:35%;width:30%"></div><i></i></div>
          <div class="row" style="margin-top:10px"><span class="small">${p.ctrl}</span><input type="range" min="0" max="100" value="50" class="ctl" style="flex:1"></div>
          ${p.id === 'co2' ? '<button class="btn danger small backup hidden">⚠ Включить резервный скруббер</button>' : ''}</div>`).join('')}</div></div>`);
      root.appendChild(el);
      api.hint('Двигайте ползунки, чтобы компенсировать изменения. Если что-то откажет — я предупрежу. Помните: управление работает с задержкой, не дёргайте ползунки слишком резко.');
      const st = P.map((p) => ({ p, v: 50, dmd: R.range(35, 65), dd: R.range(-4, 4), card: $(`[data-p="${p.id}"]`, el) }));
      st.forEach((x) => { x.ctl = $('.ctl', x.card); });
      let t = 0, good = 0, samples = 0, scrubberFail = false, heat = 0, over = false, ev1 = false;
      const backup = $('.backup', el);
      backup.addEventListener('click', () => { scrubberFail = false; backup.classList.add('hidden'); api.hint('Резервный скруббер работает. Отличная реакция!'); });
      S.raf((dt) => {
        if (over) return false;
        t += dt;
        if (t > 14 && !ev1) { ev1 = true; scrubberFail = true; backup.classList.remove('hidden'); api.hint('⚠ Отказ основного скруббера CO₂! Включите резервный — кнопка в карточке CO₂.'); }
        if (t > 27 && heat === 0) { heat = 1; api.hint('⚠ Перегрев блока электроники: температура в кабине растёт. Добавьте охлаждение!'); }
        st.forEach((x) => {
          x.dd += R.gauss() * 6 * dt; x.dd = clamp(x.dd, -6, 6);
          x.dmd = clamp(x.dmd + x.dd * dt, 20, 80);
          let c = +x.ctl.value;
          let dmd = x.dmd;
          if (x.p.id === 'co2' && scrubberFail) c = 0;
          if (x.p.id === 't' && heat) dmd -= 18;
          x.v += x.p.sign * 0.35 * (c - dmd) * dt;
          x.v = clamp(x.v, 0, 100);
          const ok = x.v >= 35 && x.v <= 65;
          samples++; if (ok) good++;
          $('.val', x.card).textContent = fmt(x.p.a + x.p.b * x.v, x.p.d);
          const bar = $('.meter i', x.card);
          bar.style.width = `${x.v}%`; bar.style.background = ok ? '#4fe08a' : '#ff5d6c';
        });
        $('.left', el).textContent = Math.max(0, Math.ceil(40 - t));
        if (t >= 40) {
          over = true;
          const pct = (good / samples) * 100;
          scores.push(clamp(pct * 1.1, 0, 100));
          details.push(`Жизнеобеспечение: параметры в норме ${fmt(pct, 0)}% времени${scrubberFail ? ', <span class="bad">резервный скруббер не включён</span>' : ''}`);
          api.hint('Системы жизнеобеспечения проверены. Готовимся к разгону к Луне!');
          next(tli);
        }
      });
    }

    /* ---------- 3. Разгон к Луне ---------- */
    function tli() {
      root.innerHTML = '';
      const TARGET = 3150;
      const el = h(`<div>${header(2, 'Этап 3: импульс отлёта к Луне (TLI)')}
        <canvas class="game-canvas" width="${W}" height="${H}"></canvas></div>`);
      root.appendChild(el);
      el.appendChild(touchControls(S, [[{ label: 'Пробел: двигатель', code: 'Space', wide: true }]]));
      api.hint(`Нужно разогнаться ровно на ${TARGET} м/с — тогда корабль уйдёт на траекторию свободного возврата: облетит Луну и сам вернётся к Земле. Пробел — включить двигатель, ещё раз Пробел — выключить.`);
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const s = { dv: 0, burning: false, done: false, t: 0, anim: 0, err: 0 };
      S.on(window, 'keydown', (e) => {
        if (e.code !== 'Space' || s.done) return;
        if (!s.burning) s.burning = true;
        else { s.burning = false; s.done = true; s.err = s.dv - TARGET; finishTli(); }
      });
      const finishTli = () => {
        const sc = clamp(100 - Math.abs(s.err) * 1.4, 0, 100);
        scores.push(sc);
        const fly = 8000 + s.err * 60;
        details.push(`Разгон к Луне: Δv = ${fmt(s.dv, 0)} м/с (ошибка ${s.err > 0 ? '+' : ''}${fmt(s.err, 0)} м/с), пролёт над обратной стороной Луны на высоте ~${fmt(Math.max(100, fly), 0)} км`);
        api.hint(Math.abs(s.err) < 15 ? 'Идеальный импульс! Корабль на траектории свободного возврата.' : Math.abs(s.err) < 50 ? 'Небольшая ошибка — исправим коррекцией на трассе.' : 'Большая ошибка: понадобятся серьёзные коррекции и лишнее топливо.');
        S.timeout(reentry, 5200);
      };
      S.raf((dt) => {
        s.t += dt;
        if (s.burning) { s.dv += 125 * dt; if (s.dv > TARGET + 400) { s.burning = false; s.done = true; s.err = s.dv - TARGET; finishTli(); } }
        if (s.done) s.anim = Math.min(1, s.anim + dt / 4.5);
        drawTli(ctx, s, TARGET);
      });
    }
    function bez(p0, p1, p2, p3, t) { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
    function drawTli(ctx, s, TARGET) {
      ctx.fillStyle = '#02040c'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 80; i++) { ctx.fillStyle = '#89a'; ctx.fillRect((i * 173) % W, (i * 97) % H, 1, 1); }
      const E = [150, 260], M = [790, 260];
      const rf = clamp(40 + s.err * 0.5, 14, 160);
      // траектория
      const pts = [];
      for (let t = 0; t <= 1; t += 0.02) pts.push(bez([E[0] + 30, E[1] - 18], [400, 150], [600, 420], [M[0], M[1] + rf], t));
      for (let a = Math.PI / 2; a >= -Math.PI / 2; a -= 0.1) pts.push([M[0] + Math.cos(a) * rf, M[1] + Math.sin(a) * rf]);
      for (let t = 0; t <= 1; t += 0.02) pts.push(bez([M[0], M[1] - rf], [600, 100], [400, 370], [E[0] + 30, E[1] + 18], t));
      ctx.setLineDash([6, 6]); ctx.strokeStyle = s.done ? 'rgba(124,240,208,.9)' : 'rgba(124,240,208,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]);
      // Земля и Луна
      let g = ctx.createRadialGradient(E[0] - 10, E[1] - 10, 5, E[0], E[1], 34); g.addColorStop(0, '#9fd3ff'); g.addColorStop(1, '#1e5bb8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(E[0], E[1], 32, 0, 7); ctx.fill();
      g = ctx.createRadialGradient(M[0] - 5, M[1] - 5, 2, M[0], M[1], 12); g.addColorStop(0, '#eee'); g.addColorStop(1, '#888');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(M[0], M[1], 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#cfe'; ctx.font = '14px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText('Земля', E[0], E[1] + 52); ctx.fillText('Луна', M[0], M[1] + 30);
      if (s.done) { const p = pts[Math.min(pts.length - 1, Math.floor(s.anim * (pts.length - 1)))]; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); }
      // шкала
      ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(250, 390, 460, 76);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Exo 2"'; ctx.fillText(`Δv: ${fmt(s.dv, 0)} / ${TARGET} м/с`, W / 2, 418);
      ctx.fillStyle = '#222'; ctx.fillRect(270, 430, 420, 14);
      ctx.fillStyle = s.burning ? '#ffb547' : '#4ea3ff'; ctx.fillRect(270, 430, clamp(s.dv / (TARGET + 400), 0, 1) * 420, 14);
      ctx.fillStyle = '#4fe08a'; ctx.fillRect(270 + (TARGET / (TARGET + 400)) * 420 - 1, 426, 3, 22);
      ctx.font = '13px "Exo 2"'; ctx.fillStyle = s.burning ? '#ffb547' : '#93a2c4';
      ctx.fillText(s.done ? `Двигатель выключен. Ошибка: ${s.err > 0 ? '+' : ''}${fmt(s.err, 0)} м/с` : s.burning ? 'ДВИГАТЕЛЬ РАБОТАЕТ — Пробел, чтобы выключить' : 'Пробел — включить двигатель', W / 2, 460);
    }

    /* ---------- 4. Вход в атмосферу и приводнение ---------- */
    function reentry() {
      root.innerHTML = '';
      const el = h(`<div>${header(3, 'Этап 4: вход в атмосферу и приводнение')}<canvas class="game-canvas" width="${W}" height="${H}"></canvas></div>`);
      root.appendChild(el);
      el.appendChild(touchControls(S, [[{ label: '▲', code: 'ArrowUp' }, { label: '▼', code: 'ArrowDown' }], [{ label: 'Парашюты', code: 'Space', wide: true }]]));
      api.hint('Капсула входит в атмосферу на скорости около 11 км/с. Держите угол входа в коридоре 5,5–7°: круче — перегрев и перегрузка, положе — капсула отскочит от атмосферы. Стрелки ▲/▼ — управление подъёмной силой.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const s = { g: 6.2, dg: 0, t: 0, inC: 0, n: 0, heat: 0, phase: 'entry', alt: 6000, chute: null, maxHeat: 0 };
      S.on(window, 'keydown', (e) => {
        if (e.code !== 'Space' || s.phase !== 'chute') return;
        s.chute = s.alt; s.phase = 'land';
      });
      S.raf((dt) => {
        s.t += dt;
        if (s.phase === 'entry') {
          s.dg += R.gauss() * 1.4 * dt; s.dg = clamp(s.dg, -0.7, 0.7);
          let c = 0; if (keys.ArrowUp) c -= 1; if (keys.ArrowDown) c += 1;
          s.g += (s.dg * 0.7 + c * 1.2) * dt;
          s.g = clamp(s.g, 3.5, 9);
          s.n++; if (s.g >= 5.5 && s.g <= 7) s.inC++;
          s.heat = clamp(s.heat + (s.g > 7 ? (s.g - 7) * 30 : -10) * dt, 0, 100); s.maxHeat = Math.max(s.maxHeat, s.heat);
          if (s.t > 25) { s.phase = 'chute'; api.hint('Плазма позади! Высота падает. Выпустите основные парашюты на высоте от 2,5 до 3,5 км — Пробел.'); }
        } else if (s.phase === 'chute') {
          s.alt -= 200 * dt;
          if (s.alt <= 600) { s.chute = 0; s.phase = 'land'; }
        } else if (s.phase === 'land') {
          s.alt -= (s.chute > 0 ? 40 : 300) * dt;
          if (s.alt <= 0) { s.alt = 0; s.phase = 'done'; finishEntry(); return false; }
        }
        drawEntry(ctx, s);
      });
      const finishEntry = () => {
        const corr = (s.inC / s.n) * 100;
        const chuteOk = s.chute >= 2500 && s.chute <= 3500;
        const chuteScore = s.chute === 0 ? 0 : chuteOk ? 100 : clamp(100 - Math.min(Math.abs(s.chute - 3000) - 500, 3000) / 15, 20, 90);
        const sc = corr * 0.65 + chuteScore * 0.25 + (100 - s.maxHeat) * 0.1;
        scores.push(sc);
        details.push(`Вход в атмосферу: в коридоре ${fmt(corr, 0)}% времени, макс. перегрев теплозащиты ${fmt(s.maxHeat, 0)}%`);
        details.push(s.chute === 0 ? '<span class="bad">Парашюты выпущены автоматикой слишком поздно — жёсткое приводнение</span>' : `Парашюты: на высоте ${fmt(s.chute / 1000, 2)} км ${chuteOk ? '✅' : '(вне оптимального окна)'}`);
        details.push('Приводнение в Тихом океане у берегов Сан-Диего. Экипаж поднят на борт корабля ВМС.');
        const total = scores.reduce((a, b) => a + b, 0) / 4;
        S.timeout(() => api.finish(total, details), 1600);
      };
    }
    function drawEntry(ctx, s) {
      if (s.phase === 'entry') {
        ctx.fillStyle = '#04081a'; ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(W / 2, 1400, 900, W / 2, 1400, 1150); g.addColorStop(0, '#1d5fb4'); g.addColorStop(0.92, '#5aa0e8'); g.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, 1400, 1150, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(W / 2 - 100, 220); ctx.rotate((s.g - 6.2) * 0.15 + 0.3);
        const pl = ctx.createRadialGradient(-30, 0, 5, -30, 0, 80 + s.heat);
        pl.addColorStop(0, 'rgba(255,240,200,.95)'); pl.addColorStop(0.5, 'rgba(255,120,40,.6)'); pl.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = pl; ctx.beginPath(); ctx.arc(-30, 0, 80 + s.heat, 0, 7); ctx.fill();
        ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(-18, -30); ctx.lineTo(-18, 30); ctx.lineTo(30, 14); ctx.lineTo(30, -14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(-22, -30, 6, 60);
        ctx.restore();
        // индикатор коридора
        const x0 = 640, y0 = 60, hh = 320;
        const Y = (g) => y0 + ((g - 3.5) / 5.5) * hh;
        ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(x0 - 20, y0 - 40, 300, hh + 70);
        ctx.fillStyle = 'rgba(79,224,138,.25)'; ctx.fillRect(x0, Y(5.5), 60, Y(7) - Y(5.5));
        ctx.fillStyle = 'rgba(255,93,108,.18)'; ctx.fillRect(x0, Y(7), 60, Y(9) - Y(7));
        ctx.fillStyle = 'rgba(255,181,71,.18)'; ctx.fillRect(x0, y0, 60, Y(5.5) - y0);
        ctx.fillStyle = '#fff'; ctx.fillRect(x0 - 6, Y(s.g) - 2, 72, 4);
        ctx.font = '13px "Exo 2"'; ctx.textAlign = 'left';
        ctx.fillStyle = '#ffb547'; ctx.fillText('отскок', x0 + 70, Y(4.4));
        ctx.fillStyle = '#4fe08a'; ctx.fillText('коридор входа', x0 + 70, Y(6.3));
        ctx.fillStyle = '#ff5d6c'; ctx.fillText('перегрев', x0 + 70, Y(8));
        ctx.fillStyle = '#fff'; ctx.font = '15px "Exo 2"';
        ctx.fillText(`Угол входа: ${fmt(s.g, 2)}°`, x0, y0 - 14);
        ctx.fillText(`Теплозащита: ${fmt(s.heat, 0)}%`, x0, y0 + hh + 24);
        ctx.fillText(`T+${fmt(s.t, 0)} / 25 c`, 30, 30);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5aa8ef'); g.addColorStop(1, '#bfe2ff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const sea = 680 - (s.alt / 6000) * 300;
        ctx.fillStyle = '#1c5f9a'; ctx.fillRect(0, Math.min(H, sea), W, H);
        const cy = Math.min(sea - 30, 240);
        if (s.chute > 0 && s.phase !== 'chute') {
          ctx.fillStyle = '#ff7a2a';
          [-60, 0, 60].forEach((dx) => { ctx.beginPath(); ctx.arc(W / 2 + dx, cy - 110, 40, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W / 2 + dx - 40, cy - 110); ctx.lineTo(W / 2, cy - 20); ctx.moveTo(W / 2 + dx + 40, cy - 110); ctx.lineTo(W / 2, cy - 20); ctx.stroke(); });
        }
        ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(W / 2 - 30, cy); ctx.lineTo(W / 2 + 30, cy); ctx.lineTo(W / 2 + 14, cy - 34); ctx.lineTo(W / 2 - 14, cy - 34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,8,20,.7)'; ctx.fillRect(20, 20, 320, 60);
        ctx.fillStyle = '#fff'; ctx.font = '18px "Exo 2"'; ctx.textAlign = 'left';
        ctx.fillText(`Высота: ${fmt(s.alt / 1000, 2)} км`, 34, 46);
        ctx.font = '13px "Exo 2"'; ctx.fillStyle = s.alt <= 3500 && s.alt >= 2500 ? '#4fe08a' : '#93a2c4';
        ctx.fillText(s.phase === 'chute' ? 'Окно выпуска парашютов: 2,5–3,5 км' : s.alt > 0 ? 'Спуск на парашютах' : 'Приводнение!', 34, 68);
        if (s.phase === 'done') { ctx.fillStyle = '#fff'; ctx.font = 'bold 28px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText('Приводнение у Сан-Диего!', W / 2, 120); }
      }
    }

    launch();
  }

  Missions.register({
    id: 'testflight', role: 'pilot', cat: 'moon', icon: '🚀', title: 'Испытательный полёт',
    short: 'Проверка ракеты, корабля и жизнеобеспечения с экипажем на борту',
    facts: [
      'Artemis II: четыре астронавта стартовали 1 апреля 2026 года, облетели Луну 6 апреля и приводнились у Сан-Диего 10 апреля.',
      'Это первый пилотируемый полёт к Луне за более чем 50 лет, и экипаж улетел дальше от Земли, чем кто-либо до них.',
      'Траектория свободного возврата позволяет кораблю облететь Луну и вернуться к Земле без дополнительных крупных манёвров.',
      'При возвращении от Луны капсула входит в атмосферу на скорости около 11 км/с — теплозащита нагревается почти до 2800 °C.',
    ],
    briefing: [
      'Пилот, вы назначены командиром испытательного полёта к Луне — по образцу миссии Artemis II.',
      'Задача испытаний — проверить в деле ракету, корабль и систему жизнеобеспечения с людьми на борту. Полёт пройдёт в четыре этапа.',
      '<b>Старт:</b> проведите ракету через зону максимального скоростного напора. <b>Жизнеобеспечение:</b> держите воздух в кабине в норме. <b>Разгон:</b> выдайте точный импульс к Луне. <b>Возвращение:</b> войдите в атмосферу в узком коридоре и выпустите парашюты.',
      'Экипаж доверяет вам. Поехали!',
    ],
    controls: '<b>Стрелки ▲/▼</b> — тяга и угол входа, <b>Пробел</b> — отделение ступени, двигатель, парашюты. Ползунки — мышью.',
    start,
  });
})();
