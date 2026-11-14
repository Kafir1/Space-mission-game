'use strict';
/* Миссия 1. Наблюдение Земли: анализ спутниковых данных о погоде и прогноз + поиск пожаров */
(function () {
  const REGIONS = {
    moscow: { name: 'Москва', flag: '🇷🇺', base: 5.8, amp: 13, hemi: 1, note: 'умеренный континентальный климат' },
    sandiego: { name: 'Сан-Диего', flag: '🇺🇸', base: 17.5, amp: 4.5, hemi: 1, note: 'мягкий средиземноморский климат' },
    sydney: { name: 'Сидней', flag: '🇦🇺', base: 18.2, amp: 5, hemi: -1, note: 'Южное полушарие — сезоны наоборот' },
  };
  const PERIODS = {
    week: { name: 'Неделя', desc: 'Ежедневные данные за 2 недели: температура, давление, осадки. Прогноз на 7 дней.' },
    month: { name: 'Месяц', desc: 'Ежедневные данные за 3 месяца. Прогноз средней температуры на 4 недели вперёд.' },
    year: { name: 'Год', desc: 'Среднемесячные данные за 3 года. Прогноз на 12 месяцев вперёд.' },
  };
  const TODAY_DOY = 318; // 14 ноября
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  const seasonT = (reg, doy) => reg.base - reg.hemi * reg.amp * Math.cos((2 * Math.PI * (doy - 15)) / 365);
  function doyLabel(doy) {
    const d = new Date(Date.UTC(2026, 0, 1) + (doy - 1) * 864e5);
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function generate(reg, period) {
    const r = rng(Math.floor(Math.random() * 1e9));
    if (period === 'week') {
      const phi = r.range(0, Math.PI * 2), A = r.range(8, 12), per = r.range(7.5, 9.5);
      const all = [];
      for (let i = 0; i < 21; i++) {
        const doy = TODAY_DOY - 14 + i;
        const p = 1013 + A * Math.sin((2 * Math.PI * i) / per + phi) + r.gauss() * 1.2;
        const t = seasonT(reg, doy) + 0.28 * (p - 1013) + r.gauss() * 0.7;
        const rain = p < 1007 ? (1007 - p) * 1.6 + r.range(0, 3) : 0;
        all.push({ x: i, t, p, rain, label: doyLabel(doy) });
      }
      const rainyDays = all.slice(14).filter((d) => d.rain > 0.5).length;
      const opts = ['0 дней', '1–2 дня', '3–4 дня', '5–7 дней'];
      const correct = rainyDays === 0 ? 0 : rainyDays <= 2 ? 1 : rainyDays <= 4 ? 2 : 3;
      return {
        domain: [0, 20], hist: all.slice(0, 14), actual: all.slice(14),
        fore: all.slice(14).map((d) => ({ x: d.x, v: all[13].t, real: d.t })),
        unit: 'день', hasP: true,
        question: { text: 'Сколько дней с осадками ожидается на следующей неделе?', opts, correct, explain: `Дождь идёт, когда давление падает ниже ~1007 гПа. Фактически дождливых дней: ${rainyDays}.` },
        lesson: 'При падении атмосферного давления приходит циклон: облачно, прохладнее, осадки. Рост давления — антициклон: ясно и сухо. Колебания давления повторяются с периодом примерно 7–10 дней.',
      };
    }
    if (period === 'month') {
      const phi = r.range(0, 6.28);
      const all = [];
      for (let i = 0; i < 118; i++) {
        const doy = TODAY_DOY - 90 + i;
        const t = seasonT(reg, doy) + 2.8 * Math.sin((2 * Math.PI * i) / 9 + phi) + r.gauss() * 1.1;
        all.push({ x: i, t, label: doyLabel(doy) });
      }
      const hist = all.slice(0, 90), act = all.slice(90);
      const fore = [0, 1, 2, 3].map((k) => {
        const wk = act.slice(k * 7, k * 7 + 7);
        return { x: 90 + k * 7 + 3, v: hist[89].t, real: wk.reduce((s, d) => s + d.t, 0) / wk.length };
      });
      const lastMean = hist.slice(-28).reduce((s, d) => s + d.t, 0) / 28;
      const nextMean = fore.reduce((s, f) => s + f.real, 0) / 4;
      const diff = nextMean - lastMean;
      const correct = diff > 1 ? 0 : diff < -1 ? 2 : 1;
      return {
        domain: [0, 117], hist, actual: act, fore, unit: 'день', hasP: false,
        question: { text: 'Какой тренд температуры будет в следующем месяце?', opts: ['Потепление', 'Без изменений', 'Похолодание'], correct, explain: `Средняя температура изменится на ${diff > 0 ? '+' : ''}${fmt(diff, 1)} °C по сравнению с последними 4 неделями.` },
        lesson: 'На масштабе месяца главную роль играет смена сезонов: важно понимать, в каком полушарии находится регион. Короткие колебания по 1–2 недели — это проходящие циклоны и антициклоны.',
      };
    }
    // year
    const trend = r.range(0.25, 0.45);
    const all = [];
    for (let i = 0; i < 48; i++) {
      const m = i % 12, yr = Math.floor(i / 12);
      const t = seasonT(reg, m * 30.4 + 15) + trend * yr + r.gauss() * 0.6;
      all.push({ x: i, t, label: `${MONTHS[m]} ${2023 + yr}` });
    }
    const hist = all.slice(0, 36), act = all.slice(36);
    const meanHist = hist.reduce((s, d) => s + d.t, 0) / 36;
    const fore = act.map((d) => ({ x: d.x, v: meanHist, real: d.t }));
    const lastY = hist.slice(24).reduce((s, d) => s + d.t, 0) / 12;
    const nextY = act.reduce((s, d) => s + d.t, 0) / 12;
    const diff = nextY - lastY;
    const correct = diff > 0.2 ? 0 : diff < -0.2 ? 2 : 1;
    return {
      domain: [0, 47], hist, actual: act, fore, unit: 'месяц', hasP: false,
      question: { text: 'Каким будет следующий год в среднем по сравнению с прошлым?', opts: ['Теплее', 'Примерно так же', 'Холоднее'], correct, explain: `Среднегодовая температура изменится на ${diff > 0 ? '+' : ''}${fmt(diff, 2)} °C. ${diff > 0.2 ? 'Это проявление долгосрочного потепления климата.' : 'Тренд потепления есть, но в этом году его скрыли естественные колебания погоды.'}` },
      lesson: 'Годовой график — это сезонная волна плюс медленный тренд. Спутники фиксируют, что каждый год в среднем немного теплее предыдущего: это глобальное потепление.',
    };
  }

  function drawChart(ctx, data, showActual) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const pad = { l: 54, r: data.hasP ? 66 : 20, t: 20, b: 44 };
    const all = data.hist.map((d) => d.t).concat(data.actual.map((d) => d.t), data.fore.map((f) => f.v));
    const lo = Math.floor(Math.min(...all) - 3), hi = Math.ceil(Math.max(...all) + 3);
    const X = (x) => pad.l + ((x - data.domain[0]) / (data.domain[1] - data.domain[0])) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const PY = (p) => pad.t + (1 - (p - 990) / (1036 - 990)) * (H - pad.t - pad.b);
    data._map = { X, Y, lo, hi, pad, inv: (py) => lo + (1 - (py - pad.t) / (H - pad.t - pad.b)) * (hi - lo) };

    ctx.fillStyle = '#071024'; ctx.fillRect(0, 0, W, H);
    const fx0 = X(data.hist[data.hist.length - 1].x + 0.5);
    ctx.fillStyle = 'rgba(78,163,255,0.08)'; ctx.fillRect(fx0, pad.t, W - pad.r - fx0, H - pad.t - pad.b);
    ctx.fillStyle = '#7fb6ff'; ctx.font = '13px "Exo 2", sans-serif';
    ctx.fillText('ПРОГНОЗ', fx0 + 8, pad.t + 16);

    // сетка
    ctx.strokeStyle = 'rgba(140,170,230,0.12)'; ctx.lineWidth = 1; ctx.fillStyle = '#93a2c4'; ctx.textAlign = 'right';
    const step = (hi - lo) > 24 ? 5 : 2;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(`${v}°`, pad.l - 8, Y(v) + 4);
    }
    if (data.hasP) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#6fb0d8';
      for (let p = 995; p <= 1025; p += 10) ctx.fillText(`${p}`, W - pad.r + 6, PY(p) + 4);
      ctx.fillText('гПа', W - pad.r + 6, pad.t + 4);
    }
    // подписи оси X
    ctx.textAlign = 'center'; ctx.fillStyle = '#93a2c4';
    const labs = data.hist.concat(data.actual);
    const every = Math.ceil(labs.length / 10);
    labs.forEach((d, i) => { if (i % every === 0) ctx.fillText(d.label, X(d.x), H - pad.b + 20); });

    // осадки
    if (data.hasP) {
      const bw = (X(1) - X(0)) * 0.5;
      const bars = data.hist.concat(showActual ? data.actual : []);
      bars.forEach((d) => { if (d.rain > 0) { ctx.fillStyle = 'rgba(90,160,255,0.55)'; const hh = d.rain * 6; ctx.fillRect(X(d.x) - bw / 2, H - pad.b - hh, bw, hh); } });
    }
    const line = (pts, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]);
    };
    if (data.hasP) line(data.hist.map((d) => [X(d.x), PY(d.p)]), '#3fa6d8', 2, [5, 4]);
    line(data.hist.map((d) => [X(d.x), Y(d.t)]), '#ff9f43', 2.5);
    if (showActual) {
      if (data.hasP) line(data.actual.map((d) => [X(d.x), PY(d.p)]), 'rgba(63,166,216,0.7)', 2, [5, 4]);
      line([data.hist[data.hist.length - 1]].concat(data.actual).map((d) => [X(d.x), Y(d.t)]), '#4fe08a', 2.5);
      data.fore.forEach((f) => { ctx.fillStyle = '#4fe08a'; ctx.beginPath(); ctx.arc(X(f.x), Y(f.real), 4, 0, 7); ctx.fill(); });
    }
    // точки прогноза
    const last = data.hist[data.hist.length - 1];
    line([[X(last.x), Y(last.t)]].concat(data.fore.map((f) => [X(f.x), Y(f.v)])), '#ffffff', 2, [3, 3]);
    data.fore.forEach((f) => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4ea3ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(X(f.x), Y(f.v), 8, 0, 7); ctx.fill(); ctx.stroke();
    });
    // легенда
    ctx.textAlign = 'left'; ctx.font = '13px "Exo 2", sans-serif';
    let lx = pad.l + 8; const ly = H - 10;
    const leg = [['#ff9f43', 'Температура'], ['#fff', 'Ваш прогноз']];
    if (data.hasP) leg.push(['#3fa6d8', 'Давление'], ['rgba(90,160,255,0.8)', 'Осадки']);
    if (showActual) leg.push(['#4fe08a', 'Факт']);
    leg.forEach(([c, t]) => { ctx.fillStyle = c; ctx.fillRect(lx, ly - 9, 14, 8); ctx.fillStyle = '#c9d4ee'; ctx.fillText(t, lx + 18, ly); lx += ctx.measureText(t).width + 40; });
  }

  function start(root, api) {
    const S = api.scope;
    const state = { region: null, period: null };
    let total = { fore: 0, q: 0, fires: 0 };
    const details = [];

    // Шаг 1 — выбор региона и периода
    api.hint('Выберите регион наблюдения и период данных, который вам нужен.');
    root.innerHTML = '';
    const pick = h(`
      <div>
        <div class="card"><h4>1. Регион наблюдения</h4><div class="choices reg">${Object.entries(REGIONS).map(([k, r]) => `<button class="choice" data-r="${k}"><b>${r.flag} ${r.name}</b><span class="muted small">${r.note}</span></button>`).join('')}</div></div>
        <div class="card"><h4>2. Период данных</h4><div class="choices per">${Object.entries(PERIODS).map(([k, p]) => `<button class="choice" data-p="${k}"><b>${p.name}</b><span class="muted small">${p.desc}</span></button>`).join('')}</div></div>
        <div class="row center"><button class="btn btn-primary big" data-go disabled>Загрузить спутниковые данные ▸</button></div>
      </div>`);
    root.appendChild(pick);
    const go = $('[data-go]', pick);
    pick.addEventListener('click', (e) => {
      const r = e.target.closest('[data-r]'), p = e.target.closest('[data-p]');
      if (r) { state.region = r.dataset.r; $$('[data-r]', pick).forEach((b) => b.classList.toggle('sel', b === r)); }
      if (p) { state.period = p.dataset.p; $$('[data-p]', pick).forEach((b) => b.classList.toggle('sel', b === p)); }
      go.disabled = !(state.region && state.period);
      if (e.target.closest('[data-go]') && !go.disabled) forecastStep();
    });

    // Шаг 2 — анализ и прогноз
    function forecastStep() {
      const reg = REGIONS[state.region];
      const data = generate(reg, state.period);
      root.innerHTML = '';
      api.hint(`Данные со спутника по региону «${reg.name}» получены. Перетаскивайте белые точки в зоне прогноза, чтобы задать ожидаемую температуру, и ответьте на вопрос.`);
      const el = h(`
        <div>
          <div class="stage-title"><h3>${reg.flag} ${reg.name}: ${PERIODS[state.period].name.toLowerCase()}</h3><span class="muted small">Шаг 1 из 2 · прогноз погоды</span></div>
          <div class="card small"><b>Как ведёт себя погода:</b> ${data.lesson}</div>
          <canvas class="game-canvas" width="960" height="420"></canvas>
          <div class="card"><h4>${data.question.text}</h4><div class="choices q">${data.question.opts.map((o, i) => `<button class="choice" data-q="${i}"><b>${o}</b></button>`).join('')}</div>
          <div class="row center"><button class="btn btn-primary" data-send disabled>📡 Отправить прогноз</button></div></div>
        </div>`);
      root.appendChild(el);
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      let answer = null, revealed = false, drag = null;
      const redraw = () => drawChart(ctx, data, revealed);
      redraw();
      const nearest = (pt) => {
        let best = null, bd = 1e9;
        data.fore.forEach((f, i) => { const d = Math.abs(data._map.X(f.x) - pt.x); if (d < bd) { bd = d; best = i; } });
        return bd < 40 ? best : null;
      };
      S.on(cv, 'pointerdown', (e) => {
        if (revealed) return;
        const p = canvasPoint(cv, e); const i = nearest(p);
        if (i == null) return;
        drag = i; cv.setPointerCapture(e.pointerId);
        data.fore[i].v = clamp(data._map.inv(p.y), data._map.lo, data._map.hi); redraw();
      });
      S.on(cv, 'pointermove', (e) => {
        if (drag == null) return;
        const p = canvasPoint(cv, e);
        data.fore[drag].v = clamp(data._map.inv(p.y), data._map.lo + 0.5, data._map.hi - 0.5); redraw();
      });
      S.on(cv, 'pointerup', () => { drag = null; });
      const send = $('[data-send]', el);
      $('.q', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-q]'); if (!b || revealed) return;
        answer = +b.dataset.q; $$('[data-q]', el).forEach((x) => x.classList.toggle('sel', x === b)); send.disabled = false;
      });
      send.addEventListener('click', () => {
        if (revealed) return;
        revealed = true; redraw();
        const mae = data.fore.reduce((s, f) => s + Math.abs(f.v - f.real), 0) / data.fore.length;
        total.fore = clamp(100 - mae * 15, 0, 100);
        const ok = answer === data.question.correct;
        total.q = ok ? 100 : 0;
        $$('[data-q]', el).forEach((x) => { const i = +x.dataset.q; if (i === data.question.correct) x.classList.add('right'); else if (i === answer) x.classList.add('wrong'); });
        details.push(`Средняя ошибка прогноза температуры: <b>${fmt(mae, 1)} °C</b> (точность ${Math.round(total.fore)}%)`);
        details.push(`Вопрос: ${ok ? '<span class="ok">верно</span>' : '<span class="bad">неверно</span>'} — ${data.question.explain}`);
        send.remove();
        const res = h(`<div class="card"><p>${ok ? '✅' : '❌'} ${data.question.explain}</p><p>Средняя ошибка вашего прогноза: <b>${fmt(mae, 1)} °C</b>. ${mae < 1.5 ? 'Отлично, уровень профессионального синоптика!' : mae < 3 ? 'Хороший результат.' : 'Прогноз заметно разошёлся с фактом — обратите внимание на тренд.'}</p>
          <div class="row center"><button class="btn btn-primary" data-next>Далее: мониторинг пожаров ▸</button></div></div>`);
        el.appendChild(res);
        api.hint('Зелёная линия — фактическая погода. Сравните её со своим прогнозом.');
        $('[data-next]', res).addEventListener('click', fireStep);
      });
    }

    // Шаг 3 — тепловой снимок, поиск очагов пожаров
    function fireStep() {
      root.innerHTML = '';
      api.hint('Срочно: инфракрасный датчик спутника фиксирует аномалии. Пожары — маленькие и очень горячие (белые) точки. Крупные оранжевые пятна — нагретые скалы и города, их отмечать не нужно.');
      const el = h(`<div><div class="stage-title"><h3>🔥 Мониторинг стихийных бедствий</h3><span class="muted small">Шаг 2 из 2 · найдено: <b class="found">0</b>/4 · время: <b class="timer">30</b> с</span></div>
        <canvas class="game-canvas" width="960" height="420" style="cursor:crosshair"></canvas></div>`);
      root.appendChild(el);
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const r = rng(Math.floor(Math.random() * 1e9));
      const W = cv.width, H = cv.height;
      // фон: плавное поле
      const lw = 240, lh = 105;
      const blobs = Array.from({ length: 18 }, () => ({ x: r() * lw, y: r() * lh, s: r.range(8, 30), a: r.range(0.1, 0.35) }));
      const decoys = Array.from({ length: 4 }, () => ({ x: r.range(20, lw - 20), y: r.range(15, lh - 15), s: r.range(6, 10), a: 0.55 }));
      const off = document.createElement('canvas'); off.width = lw; off.height = lh;
      const octx = off.getContext('2d'); const img = octx.createImageData(lw, lh);
      for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
        let v = 0.15 + 0.05 * Math.sin(x * 0.11) * Math.cos(y * 0.13);
        for (const b of blobs.concat(decoys)) v += b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s * b.s));
        v += (r() - 0.5) * 0.04; v = clamp(v, 0, 0.8);
        const i = (y * lw + x) * 4;
        img.data[i] = 255 * clamp(v * 1.8 - 0.3, 0, 1); img.data[i + 1] = 255 * clamp(v * 1.2 - 0.25, 0, 0.75); img.data[i + 2] = 255 * clamp(0.45 - v * 0.6 + 0.1, 0, 1); img.data[i + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      const fires = Array.from({ length: 4 }, () => ({ x: r.range(40, W - 40), y: r.range(40, H - 40), found: false }));
      const marks = [];
      let time = 30, misses = 0, over = false;
      const draw = () => {
        ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
        fires.forEach((f) => {
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
          g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#fffbd0'); g.addColorStop(1, 'rgba(255,200,60,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, 7); ctx.fill();
        });
        marks.forEach((m) => { ctx.strokeStyle = m.ok ? '#4fe08a' : '#ff5d6c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.x, m.y, 16, 0, 7); ctx.stroke(); });
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, 250, 26);
        ctx.fillStyle = '#cfe'; ctx.font = '13px "Exo 2", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('ИК-канал 3.9 мкм · разрешение 375 м', 8, 18);
      };
      draw();
      const end = () => {
        if (over) return; over = true;
        const found = fires.filter((f) => f.found).length;
        total.fires = clamp(found * 25 - misses * 8, 0, 100);
        details.push(`Обнаружено очагов пожара: <b>${found}/4</b>, ложных срабатываний: ${misses}`);
        const score = total.fore * 0.5 + total.q * 0.25 + total.fires * 0.25;
        S.timeout(() => api.finish(score, details), 900);
      };
      S.on(cv, 'pointerdown', (e) => {
        if (over) return;
        const p = canvasPoint(cv, e);
        const f = fires.find((ff) => !ff.found && dist(ff.x, ff.y, p.x, p.y) < 22);
        if (f) { f.found = true; marks.push({ x: f.x, y: f.y, ok: true }); } else { misses++; marks.push({ x: p.x, y: p.y, ok: false }); }
        $('.found', el).textContent = fires.filter((ff) => ff.found).length;
        draw();
        if (fires.every((ff) => ff.found)) end();
      });
      S.interval(() => { if (over) return; time--; $('.timer', el).textContent = time; if (time <= 0) end(); }, 1000);
    }
  }

  Missions.register({
    id: 'earth', role: 'scientist', cat: 'orbit', icon: '🌍', title: 'Наблюдение Земли',
    short: 'Погода, климат, пожары: анализ данных со спутника и прогноз',
    facts: [
      'С борта МКС и метеоспутников ведут наблюдение за погодой, климатом, пожарами, ледниками и стихийными бедствиями.',
      'Давление, температура и облачность связаны между собой: по ним синоптики строят прогнозы.',
      'Инфракрасные датчики спутников замечают очаги пожаров размером всего в сотни метров.',
    ],
    briefing: [
      'Ваша первая задача — наблюдение Земли. Наши спутники и приборы на МКС каждый день собирают огромные массивы данных о погоде и климате.',
      'Сначала выберите регион и период данных: неделю, месяц или год. Я покажу, как вела себя погода, и объясню закономерности.',
      'Затем вы составите прогноз на следующий такой же период — просто перетаскивайте точки на графике. После отправки сравним прогноз с фактом.',
      'И будьте готовы: в конце смены может поступить срочный снимок с очагами пожаров.',
    ],
    controls: 'Мышь или палец: выбор вариантов, перетаскивание точек прогноза, клики по тепловому снимку.',
    start,
  });
})();
