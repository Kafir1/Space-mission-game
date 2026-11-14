'use strict';
/* Миссия 5. Фотосъёмка и разведка мест посадки на Луне */
(function () {
  const W = 960, H = 540;
  const STEPS = ['Орбитальная съёмка', 'Поиск изменений', 'Движение Луны'];

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

  function start(root, api) {
    const S = api.scope;
    const keys = S.trackKeys();
    const details = [];
    const part = { a: 0, b: 0, c: 0 };
    const header = (i, t) => `<div class="stage-title"><h3>${t}</h3><div class="steps">${STEPS.map((s, k) => `<span class="step ${k < i ? 'done' : k === i ? 'on' : ''}">${s}</span>`).join('')}</div></div>`;

    /* ---------- A. Орбитальная съёмка ---------- */
    function orbitPhotos() {
      root.innerHTML = '';
      const el = h(`<div>${header(0, 'Съёмка мест посадки у южного полюса')}<canvas class="game-canvas" width="${W}" height="${H}"></canvas></div>`);
      root.appendChild(el);
      el.appendChild(touchControls(S, [
        [{ label: '◀', code: 'ArrowLeft' }, { label: '▲', code: 'ArrowUp' }, { label: '▼', code: 'ArrowDown' }, { label: '▶', code: 'ArrowRight' }],
        [{ label: 'Z зум', code: 'KeyZ', wide: true }, { label: '📸', code: 'Space' }],
      ]));
      api.hint('Аппарат летит над полюсом, поверхность движется справа налево. Стрелки ◀▶ наклоняют камеру вперёд/назад по ходу полёта, ▲▼ — поперёк. Z — зум (×1/×2/×4). Пробел — снимок. Каждая цель требует нужный зум и угол съёмки — смотрите список справа.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const TW = 5200, TH = 900;
      const tex = moonTexture(TW, TH, 7331);
      const tctx = tex.getContext('2d');
      const targets = [
        { name: 'Кратер Шеклтон', x: 1100, y: 420, r: 36, zoom: 2, angle: 'nadir', shot: null },
        { name: 'Гребень Малаперт', x: 1850, y: 260, r: 30, zoom: 1, angle: 'oblique', shot: null },
        { name: 'Кратер Де Герлах', x: 2650, y: 600, r: 32, zoom: 4, angle: 'nadir', shot: null },
        { name: 'Плато Нобиле', x: 3500, y: 330, r: 34, zoom: 2, angle: 'oblique', shot: null },
        { name: 'Кратер Хаворт', x: 4300, y: 520, r: 30, zoom: 4, angle: 'oblique', shot: null },
      ];
      targets.forEach((t) => {
        drawCrater(tctx, t.x, t.y, t.r);
        tctx.strokeStyle = 'rgba(255,220,120,.0)';
      });
      const ALT = 600; // условная высота в пикселях текстуры
      const s = { pos: 480, tilt: 0, cross: 450, zoom: 1, flash: 0, msg: '', msgT: 0, over: false, shots: 0 };
      const zooms = [1, 2, 4];
      S.on(window, 'keydown', (e) => {
        if (s.over) return;
        if (e.code === 'KeyZ') s.zoom = zooms[(zooms.indexOf(s.zoom) + 1) % 3];
        if (e.code === 'Space') snap();
      });
      S.on(cv, 'wheel', (e) => { e.preventDefault(); const i = zooms.indexOf(s.zoom) + (e.deltaY < 0 ? 1 : -1); s.zoom = zooms[clamp(i, 0, 2)]; }, { passive: false });
      const viewCenter = () => ({ x: s.pos + Math.tan((s.tilt * Math.PI) / 180) * ALT, y: s.cross });
      function snap() {
        s.flash = 0.25; s.shots++;
        const vc = viewCenter();
        const half = 90 / s.zoom;
        const t = targets.find((tt) => !tt.shot && Math.abs(tt.x - vc.x) < half && Math.abs(tt.y - vc.y) < half);
        if (!t) { s.msg = 'В кадре нет цели из списка.'; s.msgT = 2; return; }
        const angOk = t.angle === 'nadir' ? Math.abs(s.tilt) < 10 : Math.abs(s.tilt) >= 18 && Math.abs(s.tilt) <= 38;
        const zoomOk = s.zoom === t.zoom;
        const centered = 1 - dist(t.x, t.y, vc.x, vc.y) / (half * 1.42);
        t.shot = { angOk, zoomOk, q: Math.round(clamp((angOk ? 45 : 10) + (zoomOk ? 35 : 10) + centered * 20, 0, 100)) };
        s.msg = `${t.name}: снимок принят (${t.shot.q}%)${!angOk ? ' — неверный угол' : ''}${!zoomOk ? ' — неверный зум' : ''}`; s.msgT = 3;
      }
      S.raf((dt) => {
        if (s.over) return false;
        s.pos += 70 * dt; s.flash -= dt; s.msgT -= dt;
        if (keys.ArrowRight) s.tilt = Math.min(40, s.tilt + 30 * dt);
        if (keys.ArrowLeft) s.tilt = Math.max(-40, s.tilt - 30 * dt);
        if (keys.ArrowUp) s.cross = Math.max(80, s.cross - 220 * dt);
        if (keys.ArrowDown) s.cross = Math.min(TH - 80, s.cross + 220 * dt);
        if (s.pos > TW - 300) {
          s.over = true;
          const sum = targets.reduce((a, t) => a + (t.shot ? t.shot.q : 0), 0);
          part.a = sum / targets.length;
          details.push(`Орбитальная съёмка: снято ${targets.filter((t) => t.shot).length}/5 мест посадки, среднее качество ${fmt(part.a, 0)}%`);
          targets.filter((t) => !t.shot).forEach((t) => details.push(`<span class="warn">Пропущена цель: ${t.name}</span>`));
          S.timeout(blink, 600);
        }
        // отрисовка
        const vc = viewCenter();
        const sw = W / s.zoom, sh = H / s.zoom;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tex, vc.x - sw / 2, vc.y - sh / 2, sw, sh, 0, 0, W, H);
        // эффект наклона: лёгкое затемнение к краю
        if (Math.abs(s.tilt) > 5) { const gg = ctx.createLinearGradient(0, 0, W, 0); const a = Math.abs(s.tilt) / 80; if (s.tilt > 0) { gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, `rgba(0,0,0,${a})`); } else { gg.addColorStop(0, `rgba(0,0,0,${a})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); } ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); }
        // метки целей
        targets.forEach((t) => {
          const sx = (t.x - vc.x) * s.zoom + W / 2, sy = (t.y - vc.y) * s.zoom + H / 2;
          if (sx < -60 || sx > W + 60) return;
          ctx.strokeStyle = t.shot ? 'rgba(79,224,138,.8)' : 'rgba(255,210,90,.9)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, sy, t.r * s.zoom + 8, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#ffd25a'; ctx.font = '14px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText(t.name, sx, sy - t.r * s.zoom - 14);
        });
        // рамка кадра
        const fr = 90;
        ctx.strokeStyle = '#7cf0d0'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - fr, H / 2 - fr, fr * 2, fr * 2);
        ctx.beginPath(); ctx.moveTo(W / 2 - 10, H / 2); ctx.lineTo(W / 2 + 10, H / 2); ctx.moveTo(W / 2, H / 2 - 10); ctx.lineTo(W / 2, H / 2 + 10); ctx.stroke();
        if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${s.flash * 3})`; ctx.fillRect(0, 0, W, H); }
        // HUD
        ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(10, 10, 250, 80);
        ctx.fillStyle = '#fff'; ctx.font = '14px "Exo 2"'; ctx.textAlign = 'left';
        ctx.fillText(`Наклон камеры: ${fmt(s.tilt, 0)}° ${Math.abs(s.tilt) < 10 ? '(надир)' : Math.abs(s.tilt) >= 18 && Math.abs(s.tilt) <= 38 ? '(наклонная)' : ''}`, 20, 32);
        ctx.fillText(`Зум: ×${s.zoom}`, 20, 54);
        ctx.fillText(`Пройдено: ${fmt((s.pos / (TW - 300)) * 100, 0)}% витка`, 20, 76);
        ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(W - 330, 10, 320, 26 + targets.length * 22);
        ctx.fillStyle = '#7cf0d0'; ctx.fillText('Список целей', W - 318, 30);
        targets.forEach((t, i) => {
          ctx.fillStyle = t.shot ? '#4fe08a' : '#fff';
          ctx.fillText(`${t.shot ? '✓' : '○'} ${t.name}: ×${t.zoom}, ${t.angle === 'nadir' ? 'надир <10°' : 'наклон 18–38°'}`, W - 318, 52 + i * 22);
        });
        if (s.msgT > 0) { ctx.fillStyle = 'rgba(0,8,20,.85)'; ctx.fillRect(W / 2 - 280, H - 56, 560, 34); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(s.msg, W / 2, H - 34); }
      });
    }

    /* ---------- B. Мигающий компаратор: поиск нового кратера ---------- */
    function blink() {
      root.innerHTML = '';
      const el = h(`<div>${header(1, 'Поиск изменений: снимки «до» и «после»')}
        <div class="row" style="margin-bottom:8px"><button class="btn small tog">⏯ Мигание: вкл</button><span class="muted small">Раунд <b class="rd">1</b>/2 · попыток: <b class="tr">3</b></span></div>
        <div class="canvas-wrap"><canvas class="game-canvas" width="${W}" height="${H}" style="cursor:crosshair"></canvas></div></div>`);
      root.appendChild(el);
      api.hint('Сравниваем снимки одного участка, сделанные с разницей в несколько месяцев. Где-то появился свежий кратер от удара метеорита — это аномалия! Нажмите на место, где он появился.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      let round = 0, score = 0, imgs = null, fresh = null, tries = 3, blinkOn = true, showB = false, done = false;
      const makeRound = () => {
        const seed = Math.floor(Math.random() * 1e6);
        fresh = { x: R.range(120, W - 120), y: R.range(100, H - 100), r: R.range(7, 11) };
        imgs = [moonTexture(W, H, seed), moonTexture(W, H, seed)];
        const bx = imgs[1].getContext('2d');
        drawCrater(bx, fresh.x, fresh.y, fresh.r);
        bx.fillStyle = 'rgba(230,228,220,.2)'; bx.beginPath(); bx.arc(fresh.x, fresh.y, fresh.r * 2.4, 0, 7); bx.fill(); // светлый выброс
        tries = 3; $('.tr', el).textContent = tries; $('.rd', el).textContent = round + 1;
      };
      makeRound();
      $('.tog', el).addEventListener('click', (e) => { blinkOn = !blinkOn; e.target.textContent = `⏯ Мигание: ${blinkOn ? 'вкл' : 'выкл'}`; });
      let tt = 0, mark = null;
      S.raf((dt) => {
        tt += dt;
        showB = blinkOn ? Math.floor(tt / 0.6) % 2 === 1 : false;
        ctx.drawImage(imgs[showB ? 1 : 0], 0, 0);
        ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(10, 10, 200, 30);
        ctx.fillStyle = showB ? '#ffd25a' : '#7cf0d0'; ctx.font = '15px "Exo 2"'; ctx.textAlign = 'left';
        ctx.fillText(showB ? 'СНИМОК «ПОСЛЕ»' : 'СНИМОК «ДО»', 22, 31);
        if (mark) { ctx.strokeStyle = mark.ok ? '#4fe08a' : '#ff5d6c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mark.x, mark.y, 26, 0, 7); ctx.stroke(); }
        if (done) return false;
      });
      S.on(cv, 'pointerdown', (e) => {
        if (done) return;
        const p = canvasPoint(cv, e);
        const ok = dist(p.x, p.y, fresh.x, fresh.y) < 32;
        mark = { x: ok ? fresh.x : p.x, y: ok ? fresh.y : p.y, ok };
        if (ok || --tries <= 0) {
          if (ok) score += tries === 3 ? 50 : tries === 2 ? 35 : 20;
          else mark = { x: fresh.x, y: fresh.y, ok: false };
          round++;
          if (round >= 2) {
            done = true; part.b = score;
            details.push(`Поиск изменений: результат ${score}/100`);
            S.timeout(motion, 1200);
          } else S.timeout(() => { mark = null; makeRound(); }, 1200);
        }
        $('.tr', el).textContent = Math.max(tries, 0);
      });
    }

    /* ---------- C. Движение Луны: поиск аномального измерения ---------- */
    function motion() {
      root.innerHTML = '';
      const el = h(`<div>${header(2, 'Изучение движения Луны')}
        <canvas class="game-canvas" width="${W}" height="420" style="cursor:pointer"></canvas>
        <div class="card q2 hidden"><h4>В какой день Луна была ближе всего к Земле (перигей)?</h4><div class="choices"></div></div></div>`);
      root.appendChild(el);
      api.hint('Лазерные дальномеры каждый день измеряют расстояние до Луны по отражателям, оставленным на её поверхности. Орбита Луны — эллипс, поэтому расстояние плавно меняется. Одно измерение явно ошибочное — нажмите на эту точку.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const Wc = 960, Hc = 420;
      const phase = R.range(0, 6.28);
      const days = Array.from({ length: 30 }, (_, i) => ({ d: i + 1, v: 381600 - 25000 * Math.cos((2 * Math.PI * i) / 27.55 + phase) + R.gauss() * 400 }));
      const bad = R.int(4, 25);
      days[bad].v += (R() < 0.5 ? -1 : 1) * R.range(9000, 13000);
      const X = (i) => 60 + (i / 29) * (Wc - 100), Y = (v) => 30 + (1 - (v - 340000) / (420000 - 340000)) * (Hc - 80);
      let chosen = null, stage = 0, score = 0;
      const draw = () => {
        ctx.fillStyle = '#071024'; ctx.fillRect(0, 0, Wc, Hc);
        ctx.strokeStyle = 'rgba(140,170,230,.15)'; ctx.fillStyle = '#93a2c4'; ctx.font = '13px "Exo 2"'; ctx.textAlign = 'right';
        for (let v = 350000; v <= 410000; v += 10000) { ctx.beginPath(); ctx.moveTo(60, Y(v)); ctx.lineTo(Wc - 40, Y(v)); ctx.stroke(); ctx.fillText(`${v / 1000}`, 54, Y(v) + 4); }
        ctx.textAlign = 'left'; ctx.fillText('тыс. км', 8, 18);
        ctx.textAlign = 'center';
        days.forEach((d, i) => { if (i % 3 === 0) ctx.fillText(`день ${d.d}`, X(i), Hc - 20); });
        ctx.strokeStyle = 'rgba(124,240,208,.35)'; ctx.beginPath();
        days.forEach((d, i) => (i ? ctx.lineTo(X(i), Y(d.v)) : ctx.moveTo(X(i), Y(d.v)))); ctx.stroke();
        days.forEach((d, i) => {
          ctx.fillStyle = chosen === i ? (i === bad ? '#4fe08a' : '#ff5d6c') : (stage > 0 && i === bad ? '#4fe08a' : '#7cf0d0');
          ctx.beginPath(); ctx.arc(X(i), Y(d.v), chosen === i ? 8 : 5, 0, 7); ctx.fill();
        });
      };
      draw();
      S.on(cv, 'pointerdown', (e) => {
        if (stage > 0) return;
        const p = canvasPoint(cv, e);
        let best = -1, bd = 1e9;
        days.forEach((d, i) => { const dd = dist(p.x, p.y, X(i), Y(d.v)); if (dd < bd) { bd = dd; best = i; } });
        if (bd > 30) return;
        chosen = best; stage = 1;
        const ok = best === bad;
        if (ok) score += 50;
        details.push(`Аномальное измерение (день ${bad + 1}): ${ok ? '<span class="ok">найдено</span>' : '<span class="bad">не найдено</span>'}`);
        draw();
        api.hint(ok ? 'Верно! Это измерение выбивается из плавной кривой — скорее всего, сбой прибора, а не настоящая аномалия.' : `Не та точка. Ошибочное измерение было в день ${bad + 1} — оно выбивается из плавной кривой.`);
        // вопрос про перигей
        const clean = days.map((d, i) => (i === bad ? 1e9 : d.v));
        const per = clean.indexOf(Math.min(...clean));
        const opts = shuffle([per, (per + 7) % 30, (per + 14) % 30, (per + 21) % 30]);
        const q = $('.q2', el); q.classList.remove('hidden');
        const ch = $('.choices', q);
        ch.innerHTML = opts.map((o) => `<button class="choice" data-d="${o}"><b>День ${o + 1}</b></button>`).join('');
        ch.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-d]'); if (!b || stage > 1) return;
          stage = 2;
          const right = Math.abs(+b.dataset.d - per) <= 1;
          if (right) score += 50;
          $$('[data-d]', ch).forEach((x) => { if (+x.dataset.d === per) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
          details.push(`Перигей определён ${right ? '<span class="ok">верно</span>' : '<span class="bad">неверно</span>'} (день ${per + 1}, ${fmt(days[per].v, 0)} км)`);
          part.c = score;
          S.timeout(() => api.finish(part.a * 0.55 + part.b * 0.25 + part.c * 0.2, details), 1200);
        });
      });
    }

    orbitPhotos();
  }

  Missions.register({
    id: 'recon', role: 'scientist', cat: 'moon', icon: '📸', title: 'Фотосъёмка и разведка мест посадки',
    short: 'Съёмка южного полюса Луны, поиск аномалий и изучение её движения',
    facts: [
      'Снимки южного полюса Луны особенно ценны: именно там будут садиться следующие экспедиции Artemis.',
      'Солнце на полюсе всегда низко над горизонтом, поэтому тени очень длинные, а дно некоторых кратеров не освещалось миллиарды лет.',
      'Орбитальные камеры, сравнивая снимки разных лет, нашли сотни свежих ударных кратеров.',
      'Расстояние до Луны меняется примерно от 356 до 407 тыс. км — её орбита эллиптическая.',
    ],
    briefing: [
      'Учёный, следующим экспедициям нужны места для посадки. Ваша задача — разведка южного полюса Луны с орбиты.',
      'Сначала проведём <b>съёмку пяти мест посадки</b>. Для каждого места указан нужный зум и ракурс: строго вниз (надир) — для карт, наклонная съёмка — чтобы оценить рельеф и склоны.',
      'Затем — <b>поиск аномалий</b>: сравним старые и новые снимки и найдём свежие кратеры. А в конце изучим <b>движение Луны</b> по данным лазерной дальнометрии.',
    ],
    controls: '<b>Стрелки</b> — наклон камеры, <b>Z</b> или колесо мыши — зум, <b>Пробел</b> — снимок. Далее — мышью.',
    start,
  });
})();
