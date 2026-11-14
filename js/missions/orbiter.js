'use strict';
/* Миссия 9. Орбитальные аппараты Марса: картографирование, атмосфера и климат, ретрансляция связи */
(function () {
  const MW = 720, MH = 360;
  const STEPS = ['Картографирование', 'Атмосфера и климат', 'Ретрансляция'];
  const ROVERS = [
    { id: 'curiosity', name: 'Curiosity', lat: -4.6, lon: 137.4 },
    { id: 'perseverance', name: 'Perseverance', lat: 18.4, lon: 77.5 },
    { id: 'zhurong', name: 'Чжужун', lat: 25.1, lon: 109.9 },
  ];
  const toXY = (lat, lon) => [((lon + 180) / 360) * MW, ((90 - lat) / 180) * MH];
  const toLL = (x, y) => [90 - (y / MH) * 180, (x / MW) * 360 - 180];

  let marsCache = null;
  function marsMap() {
    if (marsCache) return marsCache;
    const c = document.createElement('canvas'); c.width = MW; c.height = MH;
    const x = c.getContext('2d');
    const r = rng(1965);
    x.fillStyle = '#b65a32'; x.fillRect(0, 0, MW, MH);
    for (let i = 0; i < 1800; i++) { const g = r.range(-25, 25); x.fillStyle = `rgba(${150 + g},${75 + g / 2},${40 + g / 3},.22)`; x.beginPath(); x.ellipse(r() * MW, r() * MH, r() * 9 + 2, r() * 5 + 1.5, r() * 3, 0, 7); x.fill(); }
    const blob = (lat, lon, rx, ry, col) => { const [px, py] = toXY(lat, lon); x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, 7); x.fill(); };
    blob(10, 70, 40, 30, 'rgba(70,40,30,.45)');      // Большой Сирт
    blob(45, -30, 70, 26, 'rgba(80,50,35,.35)');     // Ацидалийская равнина
    blob(-20, 20, 90, 20, 'rgba(85,50,35,.3)');
    blob(-42, 70, 45, 30, 'rgba(225,170,120,.45)');  // Эллада
    blob(18, -134, 14, 14, 'rgba(240,170,120,.6)');  // Олимп
    [[-1, -112], [11, -104], [-9, -121]].forEach(([la, lo]) => blob(la, lo, 8, 8, 'rgba(230,160,110,.55)'));
    x.strokeStyle = 'rgba(60,30,20,.6)'; x.lineWidth = 4; x.beginPath();
    const [a1, b1] = toXY(-8, -90), [a2, b2] = toXY(-12, -40); x.moveTo(a1, b1); x.quadraticCurveTo((a1 + a2) / 2, b1 + 14, a2, b2); x.stroke();
    for (let i = 0; i < 160; i++) { const px = r() * MW, py = r() * MH, rr = Math.pow(r(), 3) * 8 + 1; x.strokeStyle = 'rgba(80,40,25,.35)'; x.lineWidth = 1; x.beginPath(); x.arc(px, py, rr, 0, 7); x.stroke(); }
    const capN = x.createLinearGradient(0, 0, 0, 30); capN.addColorStop(0, 'rgba(255,255,255,.95)'); capN.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = capN; x.fillRect(0, 0, MW, 30);
    const capS = x.createLinearGradient(0, MH, 0, MH - 40); capS.addColorStop(0, 'rgba(255,255,255,.95)'); capS.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = capS; x.fillRect(0, MH - 40, MW, 40);
    marsCache = c;
    return c;
  }
  function drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { const [px] = toXY(0, lon); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, MH); ctx.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { const [, py] = toXY(lat, 0); ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(MW, py); ctx.stroke(); }
  }
  function drawRovers(ctx) {
    ROVERS.forEach((rv) => { const [px, py] = toXY(rv.lat, rv.lon); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill(); ctx.font = '11px "Exo 2"'; ctx.textAlign = 'left'; ctx.fillText(rv.name, px + 6, py + 4); });
  }

  function start(root, api) {
    const S = api.scope;
    const details = [];
    const part = { a: 0, b: 0, c: 0 };
    const header = (i, t) => `<div class="stage-title"><h3>${t}</h3><div class="steps">${STEPS.map((s, k) => `<span class="step ${k < i ? 'done' : k === i ? 'on' : ''}">${s}</span>`).join('')}</div></div>`;

    /* ---------- A. Картографирование ---------- */
    function mapping() {
      root.innerHTML = '';
      const el = h(`<div>${header(0, 'Выбор орбиты для картографирования')}
        <canvas class="game-canvas" width="${MW}" height="${MH}"></canvas>
        <div class="card"><div class="kv"><span>Наклонение орбиты</span><div class="row"><input type="range" min="0" max="90" value="45" class="inc" style="flex:1"><b class="incv">45°</b></div>
          <span>Высота орбиты</span><div class="row"><input type="range" min="250" max="1500" step="10" value="800" class="alt" style="flex:1"><b class="altv">800 км</b></div></div>
          <p class="small stats"></p>
          <div class="row center"><button class="btn run">🛰 Пробный прогон (20 витков)</button><button class="btn btn-primary approve" disabled>Утвердить орбиту ▸</button></div></div></div>`);
      root.appendChild(el);
      api.hint('Нужно снять как можно большую часть планеты и при этом с хорошей детализацией. Наклонение определяет, до каких широт долетит аппарат, а высота — ширину полосы съёмки и разрешение: чем ниже, тем детальнее, но уже полоса.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      const inc = $('.inc', el), alt = $('.alt', el);
      const map = marsMap();
      let cov = null, track = [], result = null, anim = null;
      const params = () => {
        const A = +alt.value, i = +inc.value;
        const swath = A * 0.8, res = A * 0.0012;
        const a = 3390 + A, T = 2 * Math.PI * Math.sqrt((a * a * a) / 42828);
        return { A, i, swath, res, T };
      };
      const upd = () => {
        const p = params();
        $('.incv', el).textContent = `${p.i}°`; $('.altv', el).textContent = `${p.A} км`;
        $('.stats', el).innerHTML = `Ширина полосы съёмки: <b>${fmt(p.swath, 0)} км</b> · разрешение: <b>${fmt(p.res, 2)} м/пиксель</b> · период обращения: <b>${fmt(p.T / 3600, 2)} ч</b>${result ? ` · <span class="ok">последний прогон: покрытие ${fmt(result.cov, 1)}%, оценка ${fmt(result.score, 0)}</span>` : ''}`;
      };
      inc.addEventListener('input', upd); alt.addEventListener('input', upd); upd();
      const draw = () => {
        ctx.drawImage(map, 0, 0); drawGrid(ctx);
        if (cov) { ctx.fillStyle = 'rgba(80,200,255,.28)'; for (let r = 0; r < 36; r++) for (let c = 0; c < 72; c++) if (cov[r][c]) ctx.fillRect(c * 10, r * 10, 10, 10); }
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1; ctx.beginPath();
        track.forEach(([x, y], i) => { const pr = track[i - 1]; if (i && pr && Math.abs(pr[0] - x) < MW / 2) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      };
      draw();
      $('.run', el).addEventListener('click', () => {
        if (anim) anim();
        const p = params();
        cov = Array.from({ length: 36 }, () => new Array(72).fill(false));
        track = [];
        const om = 360 / 88642, ir = (p.i * Math.PI) / 180, hw = ((p.swath / 59.3) / 2);
        const N = 20, steps = 180;
        let k = 0;
        $('.run', el).disabled = true; $('.approve', el).disabled = true;
        anim = S.raf(() => {
          for (let rep = 0; rep < 1 && k < N; rep++, k++) {
            for (let j = 0; j < steps; j++) {
              const u = (j / steps) * 2 * Math.PI;
              const t = (k + j / steps) * p.T;
              const lat = (Math.asin(Math.sin(ir) * Math.sin(u)) * 180) / Math.PI;
              let lon = (Math.atan2(Math.cos(ir) * Math.sin(u), Math.cos(u)) * 180) / Math.PI - om * t - 100;
              lon = ((lon % 360) + 540) % 360 - 180;
              const [px, py] = toXY(lat, lon); track.push([px, py]);
              const r0 = Math.floor((90 - (lat + hw)) / 5), r1 = Math.floor((90 - (lat - hw)) / 5);
              for (let r = Math.max(0, r0); r <= Math.min(35, r1); r++) {
                const clat = 90 - r * 5 - 2.5;
                const hwl = Math.min(180, hw / Math.max(0.05, Math.cos((clat * Math.PI) / 180)));
                const c0 = Math.floor((lon - hwl + 180) / 5), c1 = Math.floor((lon + hwl + 180) / 5);
                for (let c = c0; c <= c1; c++) cov[r][((c % 72) + 72) % 72] = true;
              }
            }
          }
          draw();
          if (k >= N) {
            let tot = 0, got = 0;
            for (let r = 0; r < 36; r++) { const w = Math.cos(((90 - r * 5 - 2.5) * Math.PI) / 180); for (let c = 0; c < 72; c++) { tot += w; if (cov[r][c]) got += w; } }
            const c = (got / tot) * 100;
            const resScore = clamp((1.5 - p.res) / 1.2, 0, 1) * 100;
            result = { cov: c, res: p.res, score: c * 0.6 + resScore * 0.4, i: p.i, A: p.A };
            $('.run', el).disabled = false; $('.approve', el).disabled = false; upd();
            anim = null;
            return false;
          }
        });
      });
      $('.approve', el).addEventListener('click', () => {
        if (!result) return;
        part.a = result.score;
        details.push(`Картографирование: орбита ${result.i}° / ${result.A} км, покрытие ${fmt(result.cov, 1)}%, разрешение ${fmt(result.res, 2)} м/пикс. — оценка ${fmt(result.score, 0)}`);
        climate();
      });
    }

    /* ---------- B. Атмосфера и климат ---------- */
    function climate() {
      root.innerHTML = '';
      const storm = { lat: 14 + R.range(-4, 4), lon: 72 + R.range(-6, 6) };
      const LAYERS = {
        dust: { name: '🌪 Пыль (оптическая толщина)', f: (la, lo) => 0.15 + 2.4 * Math.exp(-(((la - storm.lat) ** 2) + ((lo - storm.lon) ** 2)) / (2 * 14 * 14)), col: (v) => `rgba(255,220,150,${clamp(v / 2.6, 0, 0.85)})`, fmt: (v) => `τ = ${fmt(v, 2)}` },
        temp: { name: '🌡 Температура', f: (la) => (la < -60 ? -125 + (la + 90) * 0.9 : -20 - Math.abs(la - 15) * 1.1), col: (v) => { const t = clamp((v + 125) / 110, 0, 1); return `rgba(${Math.round(255 * t)},${Math.round(80 + 60 * t)},${Math.round(255 * (1 - t))},0.55)`; }, fmt: (v) => `${fmt(v, 0)} °C` },
        vapor: { name: '💧 Водяной пар', f: (la) => 5 + 60 * Math.exp(-((la - 78) ** 2) / (2 * 12 * 12)), col: (v) => `rgba(110,190,255,${clamp(v / 70, 0, 0.8)})`, fmt: (v) => `${fmt(v, 0)} мкм осаждённой воды` },
      };
      const Q = [
        { t: 'Отметьте на карте центр пылевой бури.', layer: 'dust', check: (la, lo) => Math.hypot(la - storm.lat, lo - storm.lon) < 18 },
        { t: 'Где сейчас самое холодное место на Марсе? Нажмите на карту.', layer: 'temp', check: (la) => la < -62 },
        { t: 'Где в атмосфере больше всего водяного пара? Нажмите на карту.', layer: 'vapor', check: (la) => la > 62 },
      ];
      const el = h(`<div>${header(1, 'Атмосфера и климат')}
        <div class="row" style="margin-bottom:8px">${Object.entries(LAYERS).map(([k, l]) => `<button class="btn small" data-l="${k}">${l.name}</button>`).join('')}</div>
        <canvas class="game-canvas" width="${MW}" height="${MH}" style="cursor:crosshair"></canvas>
        <p class="small muted readout">Наведите на карту, чтобы увидеть значение слоя.</p>
        <div class="card"><h4 class="qt"></h4><div class="choices rv hidden">${ROVERS.map((rv) => `<button class="choice" data-rv="${rv.id}"><b>${rv.name}</b></button>`).join('')}</div></div></div>`);
      root.appendChild(el);
      api.hint('Это данные спектрометров орбитальных аппаратов. Переключайте слои кнопками сверху и отвечайте на вопросы, нажимая на карту.');
      const cv = $('canvas', el), ctx = cv.getContext('2d');
      let layer = 'dust', qi = 0, right = 0;
      const marks = [];
      const layerImg = {};
      Object.entries(LAYERS).forEach(([k, l]) => {
        const c = document.createElement('canvas'); c.width = MW / 6; c.height = MH / 6; const x = c.getContext('2d');
        for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) { const [la, lo] = toLL(px * 6 + 3, py * 6 + 3); x.fillStyle = l.col(l.f(la, lo)); x.fillRect(px, py, 1, 1); }
        layerImg[k] = c;
      });
      const draw = () => {
        ctx.drawImage(marsMap(), 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.drawImage(layerImg[layer], 0, 0, MW, MH);
        drawGrid(ctx); drawRovers(ctx);
        marks.forEach((m) => { ctx.strokeStyle = m.ok ? '#4fe08a' : '#ff5d6c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.x, m.y, 12, 0, 7); ctx.stroke(); });
        $$('[data-l]', el).forEach((b) => b.classList.toggle('sel', b.dataset.l === layer));
      };
      const ask = () => {
        if (qi < Q.length) { $('.qt', el).textContent = `Вопрос ${qi + 1}/4. ${Q[qi].t}`; layer = Q[qi].layer; }
        else { $('.qt', el).textContent = 'Вопрос 4/4. Какому марсоходу угрожает пылевая буря? Его нужно перевести в режим энергосбережения.'; $('.rv', el).classList.remove('hidden'); }
      };
      ask(); draw();
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (b) { layer = b.dataset.l; draw(); } });
      S.on(cv, 'pointermove', (e) => { const p = canvasPoint(cv, e); const [la, lo] = toLL(p.x, p.y); $('.readout', el).textContent = `Широта ${fmt(la, 0)}°, долгота ${fmt(lo, 0)}° · ${LAYERS[layer].name}: ${LAYERS[layer].fmt(LAYERS[layer].f(la, lo))}`; });
      S.on(cv, 'pointerdown', (e) => {
        if (qi >= Q.length) return;
        const p = canvasPoint(cv, e); const [la, lo] = toLL(p.x, p.y);
        const ok = Q[qi].check(la, lo);
        if (ok) right++;
        marks.push({ x: p.x, y: p.y, ok });
        details.push(`Атмосфера, вопрос ${qi + 1}: ${ok ? '<span class="ok">верно</span>' : '<span class="bad">неверно</span>'}`);
        api.hint(ok ? 'Верно!' : ['Центр бури там, где пыли больше всего — включите слой пыли.', 'Самое холодное место — южная полярная шапка: там зима, и углекислый газ замерзает в «сухой лёд».', 'Больше всего пара над северной полярной шапкой: там лето, и водяной лёд испаряется.'][qi]);
        qi++; ask(); draw();
      });
      $('.rv', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-rv]'); if (!b || qi > Q.length) return;
        qi++;
        const ok = b.dataset.rv === 'perseverance';
        if (ok) right++;
        $$('[data-rv]', el).forEach((x) => { if (x.dataset.rv === 'perseverance') x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
        details.push(`Предупреждение о буре: ${ok ? '<span class="ok">Perseverance предупреждён вовремя</span>' : '<span class="bad">предупреждён не тот марсоход</span>'}`);
        part.b = right * 25;
        S.timeout(relay, 1300);
      });
    }

    /* ---------- C. Ретрансляция связи ---------- */
    function relay() {
      root.innerHTML = '';
      const N = 12;
      const VIS = { A: [1, 2, 3, 7, 8], B: [3, 4, 5, 6], E: [0, 5, 6, 9, 10, 11] };
      const DATA = { A: 4, B: 4 }, CAP = 3, TX = 2;
      const plan = new Array(N).fill(null);
      const el = h(`<div>${header(2, 'Ретрансляция данных марсоходов')}
        <div class="card small">Орбитальный аппарат пролетает над марсоходами и принимает их данные (1 пакет за интервал), а затем передаёт на Землю (до ${TX} пакетов за интервал), когда Земля в зоне видимости. Память аппарата — <b>${CAP} пакета</b>. У Perseverance и Curiosity по <b>4 пакета</b>. Каждый интервал — одно действие. Зелёные клетки — окна видимости.</div>
        <div class="relay-wrap"><table class="data relay-table"><thead><tr><th></th>${plan.map((_, i) => `<th class="small">${String(10 + Math.floor(i * 20 / 60)).padStart(2, '0')}:${String((i * 20) % 60).padStart(2, '0')}</th>`).join('')}</tr></thead>
          <tbody>${[['A', '📥 Приём: Perseverance'], ['B', '📥 Приём: Curiosity'], ['E', '📤 Передача на Землю']].map(([k, n]) => `<tr><td class="small">${n}</td>${plan.map((_, i) => `<td class="slot ${VIS[k].includes(i) ? 'vis' : ''}" data-k="${k}" data-i="${i}"></td>`).join('')}</tr>`).join('')}
          <tr><td class="small muted">Память</td>${plan.map((_, i) => `<td class="small mem" data-m="${i}"></td>`).join('')}</tr></tbody></table></div>
        <p class="sum"></p>
        <div class="row center"><button class="btn btn-primary send">📡 Утвердить расписание</button></div></div>`);
      root.appendChild(el);
      api.hint('Составьте расписание так, чтобы доставить на Землю как можно больше пакетов. Учтите: если память заполнена, принимать некуда — сначала нужно передать данные на Землю.');
      function sim(p) {
        let buf = 0, a = DATA.A, b = DATA.B, sent = 0; const mem = [];
        p.forEach((act) => {
          if (act === 'A' && a > 0 && buf < CAP) { a--; buf++; }
          if (act === 'B' && b > 0 && buf < CAP) { b--; buf++; }
          if (act === 'E') { const s = Math.min(TX, buf); buf -= s; sent += s; }
          mem.push(buf);
        });
        return { sent, mem };
      }
      // максимум (полный перебор с мемоизацией)
      const memo = new Map();
      const best = (i, buf, a, b) => {
        if (i === N) return 0;
        const key = `${i},${buf},${a},${b}`; if (memo.has(key)) return memo.get(key);
        let v = best(i + 1, buf, a, b);
        if (VIS.A.includes(i) && a > 0 && buf < CAP) v = Math.max(v, best(i + 1, buf + 1, a - 1, b));
        if (VIS.B.includes(i) && b > 0 && buf < CAP) v = Math.max(v, best(i + 1, buf + 1, a, b - 1));
        if (VIS.E.includes(i) && buf > 0) { const s = Math.min(TX, buf); v = Math.max(v, s + best(i + 1, buf - s, a, b)); }
        memo.set(key, v); return v;
      };
      const MAX = best(0, 0, DATA.A, DATA.B);
      const render = () => {
        $$('.slot', el).forEach((td) => { const on = plan[+td.dataset.i] === td.dataset.k; td.classList.toggle('act', on); td.textContent = on ? '●' : ''; });
        const { sent, mem } = sim(plan);
        mem.forEach((m, i) => { $(`[data-m="${i}"]`, el).textContent = m; });
        $('.sum', el).innerHTML = `Будет доставлено на Землю: <b>${sent}</b> пак. <span class="muted small">(всего у марсоходов 8, но окна связи не позволят передать всё — найдите лучший вариант)</span>`;
      };
      el.addEventListener('click', (e) => {
        const td = e.target.closest('.slot'); if (!td) return;
        const i = +td.dataset.i, k = td.dataset.k;
        if (!VIS[k].includes(i)) { td.animate([{ background: 'rgba(255,93,108,.4)' }, { background: 'transparent' }], { duration: 400 }); return; }
        plan[i] = plan[i] === k ? null : k; render();
      });
      $('.send', el).addEventListener('click', () => {
        const { sent } = sim(plan);
        part.c = MAX ? (sent / MAX) * 100 : 0;
        details.push(`Ретрансляция: доставлено ${sent} пакетов (максимум возможного — ${MAX})`);
        api.finish(part.a * 0.4 + part.b * 0.3 + part.c * 0.3, details);
      });
      render();
    }

    mapping();
  }

  Missions.register({
    id: 'orbiter', role: 'scientist', cat: 'mars', icon: '🪐', title: 'Орбитальные аппараты',
    short: 'Картографирование Марса, изучение атмосферы и ретрансляция связи',
    facts: [
      'Орбитальные аппараты картографируют поверхность, изучают атмосферу и климат и служат ретрансляторами связи.',
      'Большая часть данных марсоходов идёт на Землю не напрямую, а через орбитальные аппараты, например Mars Reconnaissance Orbiter.',
      'Пылевые бури на Марсе иногда охватывают всю планету и длятся месяцами. В 2018 году такая буря «усыпила» марсоход Opportunity.',
      'Полярные шапки Марса состоят из водяного льда, а зимой покрываются слоем замёрзшего углекислого газа.',
    ],
    briefing: [
      'Учёный, теперь мы отправляемся к Марсу. Пилотируемых полётов туда пока не было, поэтому всю работу делают роботы — и вы ими управляете.',
      'Сначала подберите <b>орбиту для картографирования</b>: высоту и наклонение. Затем изучите <b>атмосферу и климат</b> по данным спектрометров и предупредите марсоходы об опасности.',
      'И последнее — составьте <b>расписание ретрансляции</b>: аппарат должен забрать данные с марсоходов и передать их на Землю, пока она в зоне видимости.',
    ],
    controls: 'Ползунки и кнопки — мышью или пальцем; на карте и в таблице — клики.',
    start,
  });
})();
