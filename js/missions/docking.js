'use strict';
/* Миссия 3. Стыковка и обслуживание: удалённое управление сервисным аппаратом */
(function () {
  const W = 960, H = 540, F = 520;
  const LIM = { xy: 0.25, roll: 4, speed: 0.2 };

  function start(root, api) {
    const S = api.scope;
    const keys = S.trackKeys();
    const details = [];
    let dockScore = 0;

    root.innerHTML = '';
    const wrap = h(`<div>
      <div class="stage-title"><h3>Этап 1: стыковка</h3><div class="steps"><span class="step on">Стыковка</span><span class="step">Диагностика</span><span class="step">Дозаправка</span><span class="step">Антенна</span></div></div>
      <canvas class="game-canvas" width="${W}" height="${H}"></canvas></div>`);
    root.appendChild(wrap);
    wrap.appendChild(touchControls(S, [
      [{ label: '◀', code: 'ArrowLeft' }, { label: '▲', code: 'ArrowUp' }, { label: '▼', code: 'ArrowDown' }, { label: '▶', code: 'ArrowRight' }],
      [{ label: '⟲', code: 'KeyQ' }, { label: '⟳', code: 'KeyE' }, { label: 'W вперёд', code: 'KeyW', wide: true }, { label: 'S назад', code: 'KeyS', wide: true }],
    ]));
    const cv = $('canvas', wrap), ctx = cv.getContext('2d');
    api.hint('Вы управляете сервисным аппаратом с Земли, глядя через его стыковочную камеру. Совместите перекрестие с центром мишени, выровняйте крен и подходите медленно: у самого порта скорость должна быть меньше 0,2 м/с.');

    const r = rng(Math.floor(Math.random() * 1e9));
    const s = {
      x: r.range(-3, 3), y: r.range(-2, 2), z: 32, vx: r.range(-0.06, 0.06), vy: r.range(-0.05, 0.05), vz: 0,
      roll: r.range(-25, 25), vroll: r.range(-1.5, 1.5), fuel: 100, t: 0, attempts: 0, over: false, msg: '', msgT: 0,
    };
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H }));

    S.raf((dt) => {
      if (s.over) return false;
      s.t += dt; s.msgT -= dt;
      const a = 0.09, af = 0.07, ar = 3;
      let used = 0;
      const thr = (cond, fn) => { if (cond && s.fuel > 0) { fn(); used++; } };
      thr(keys.ArrowLeft, () => { s.vx += a * dt; });
      thr(keys.ArrowRight, () => { s.vx -= a * dt; });
      thr(keys.ArrowUp, () => { s.vy -= a * dt; });
      thr(keys.ArrowDown, () => { s.vy += a * dt; });
      thr(keys.KeyW, () => { s.vz -= af * dt; });
      thr(keys.KeyS, () => { s.vz += af * dt; });
      thr(keys.KeyQ, () => { s.vroll -= ar * dt; });
      thr(keys.KeyE, () => { s.vroll += ar * dt; });
      s.fuel = Math.max(0, s.fuel - used * dt * 0.9);
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.roll += s.vroll * dt;
      s.z = Math.min(s.z, 60);
      if (s.z <= 0.3) contact();
      if (s.t > 240) { s.over = true; endDock(false, 'Время на сближение истекло.'); }
      draw();
    });

    function contact() {
      const ok = Math.abs(s.x) < LIM.xy && Math.abs(s.y) < LIM.xy && Math.abs(s.roll) < LIM.roll && -s.vz < LIM.speed;
      if (ok) { s.over = true; draw(true); endDock(true); return; }
      s.attempts++;
      const why = [];
      if (Math.abs(s.x) >= LIM.xy || Math.abs(s.y) >= LIM.xy) why.push('смещение от оси');
      if (Math.abs(s.roll) >= LIM.roll) why.push('крен');
      if (-s.vz >= LIM.speed) why.push('высокая скорость');
      s.msg = `Касание без захвата (${why.join(', ')}). Отход на 6 м.`; s.msgT = 4;
      s.z = 6; s.vz = 0.05; s.vx *= -0.5; s.vy *= -0.5;
      if (s.attempts >= 3) { s.over = true; endDock(false, 'Три неудачных касания — стыковка выполнена в аварийном режиме манипулятором станции.'); }
    }

    function endDock(ok, note) {
      if (ok) {
        const prec = 1 - (Math.hypot(s.x, s.y) / LIM.xy) * 0.5;
        dockScore = clamp(60 + prec * 25 + (s.fuel / 100) * 15 - s.attempts * 15, 0, 100);
        details.push(`Стыковка выполнена: промах ${fmt(Math.hypot(s.x, s.y) * 100, 0)} см, крен ${fmt(s.roll, 1)}°, скорость касания ${fmt(-s.vz, 2)} м/с, повторных подходов: ${s.attempts}`);
      } else { dockScore = 15; details.push(`<span class="bad">${note}</span>`); }
      details.push(`Остаток топлива на маневры: ${Math.round(s.fuel)}%`);
      S.timeout(service, ok ? 1400 : 800);
    }

    function draw(docked) {
      ctx.fillStyle = '#01030a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#9ab';
      stars.forEach((st) => ctx.fillRect((st.x + s.x * 4) % W, (st.y + s.y * 4) % H, 1, 1));
      const cx = W / 2 + (s.x / s.z) * F, cy = H / 2 - (s.y / s.z) * F;
      const k = F / s.z;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((s.roll * Math.PI) / 180);
      // корпус спутника
      ctx.fillStyle = '#c9a548'; ctx.fillRect(-1.6 * k, -1.6 * k, 3.2 * k, 3.2 * k);
      ctx.strokeStyle = '#8a6f2a'; ctx.lineWidth = Math.max(1, k * 0.04); ctx.strokeRect(-1.6 * k, -1.6 * k, 3.2 * k, 3.2 * k);
      ctx.fillStyle = '#1d3d7c';
      ctx.fillRect(-6.5 * k, -0.9 * k, 4.6 * k, 1.8 * k); ctx.fillRect(1.9 * k, -0.9 * k, 4.6 * k, 1.8 * k);
      ctx.strokeStyle = '#5c86d6';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo((-6.5 + i * 0.92) * k, -0.9 * k); ctx.lineTo((-6.5 + i * 0.92) * k, 0.9 * k); ctx.moveTo((1.9 + i * 0.92) * k, -0.9 * k); ctx.lineTo((1.9 + i * 0.92) * k, 0.9 * k); ctx.stroke(); }
      // стыковочный узел
      ctx.fillStyle = '#d9dde6'; ctx.beginPath(); ctx.arc(0, 0, 0.8 * k, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2f3a'; ctx.beginPath(); ctx.arc(0, 0, 0.55 * k, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, k * 0.05);
      ctx.beginPath(); ctx.moveTo(0, -0.5 * k); ctx.lineTo(0, 0.5 * k); ctx.moveTo(-0.5 * k, 0); ctx.lineTo(0.5 * k, 0); ctx.stroke();
      ctx.fillStyle = '#ff4757'; ctx.beginPath(); ctx.arc(0, -0.68 * k, 0.07 * k + 1, 0, 7); ctx.fill();
      // мишень на штанге (для оценки отклонения по глубине)
      ctx.restore();
      // перекрестие камеры
      ctx.strokeStyle = 'rgba(124,240,208,.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W / 2 - 40, H / 2); ctx.lineTo(W / 2 - 10, H / 2); ctx.moveTo(W / 2 + 10, H / 2); ctx.lineTo(W / 2 + 40, H / 2);
      ctx.moveTo(W / 2, H / 2 - 40); ctx.lineTo(W / 2, H / 2 - 10); ctx.moveTo(W / 2, H / 2 + 10); ctx.lineTo(W / 2, H / 2 + 40); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(124,240,208,.35)'; ctx.beginPath(); ctx.moveTo(W / 2 - 60, H / 2 - 70); ctx.lineTo(W / 2 - 60, H / 2 - 78); ctx.lineTo(W / 2 + 60, H / 2 - 78); ctx.lineTo(W / 2 + 60, H / 2 - 70); ctx.stroke();
      // HUD
      const close = -s.vz;
      const target = Math.max(0.1, s.z * 0.04);
      const rows = [
        ['Дистанция', `${fmt(s.z, 2)} м`, true],
        ['Скорость сближения', `${fmt(close, 2)} м/с (реком. ≤ ${fmt(target, 2)})`, close <= target + 0.02 && close >= -0.05],
        ['Смещение X', `${fmt(s.x, 2)} м`, Math.abs(s.x) < LIM.xy],
        ['Смещение Y', `${fmt(s.y, 2)} м`, Math.abs(s.y) < LIM.xy],
        ['Крен', `${fmt(s.roll, 1)}°`, Math.abs(s.roll) < LIM.roll],
        ['Скорость крена', `${fmt(s.vroll, 2)} °/с`, Math.abs(s.vroll) < 0.5],
        ['Топливо', `${Math.round(s.fuel)}%`, s.fuel > 20],
      ];
      ctx.fillStyle = 'rgba(0,10,20,.65)'; ctx.fillRect(10, 10, 330, rows.length * 22 + 14);
      ctx.font = '14px "Exo 2"'; ctx.textAlign = 'left';
      rows.forEach(([a, b, ok], i) => { ctx.fillStyle = '#93a2c4'; ctx.fillText(a, 20, 32 + i * 22); ctx.fillStyle = ok ? '#4fe08a' : '#ffb547'; ctx.fillText(b, 170, 32 + i * 22); });
      ctx.fillStyle = 'rgba(0,10,20,.65)'; ctx.fillRect(W - 170, 10, 160, 50);
      ctx.fillStyle = '#ff6b6b'; ctx.fillText('● REC  CAM-DOCK', W - 158, 32);
      ctx.fillStyle = '#93a2c4'; ctx.fillText(`T+${fmt(s.t, 0)} c · подходов ${s.attempts}/3`, W - 158, 50);
      if (s.msgT > 0) { ctx.fillStyle = 'rgba(60,10,10,.85)'; ctx.fillRect(W / 2 - 280, H - 60, 560, 34); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(s.msg, W / 2, H - 38); }
      if (docked) { ctx.fillStyle = 'rgba(10,60,30,.85)'; ctx.fillRect(W / 2 - 200, H / 2 - 30, 400, 60); ctx.fillStyle = '#4fe08a'; ctx.font = 'bold 26px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText('ЗАХВАТ! СТЫКОВКА', W / 2, H / 2 + 9); }
    }

    /* ---- Обслуживание ---- */
    function setSteps(i) { const sts = ['Стыковка', 'Диагностика', 'Дозаправка', 'Антенна']; return `<div class="steps">${sts.map((t, k) => `<span class="step ${k < i ? 'done' : k === i ? 'on' : ''}">${t}</span>`).join('')}</div>`; }

    let svc = { diag: 0, fuel: 0, ant: 0 };
    function service() { diagnostics(); }

    function diagnostics() {
      const mods = [
        { n: 'Гироскоп-маховик №1', v: '28 В', t: '31 °C', c: '1,2 А', rpm: '4500 об/мин' },
        { n: 'Гироскоп-маховик №2', v: '28 В', t: '33 °C', c: '1,3 А', rpm: '4480 об/мин' },
        { n: 'Гироскоп-маховик №3', v: '27 В', t: '30 °C', c: '1,2 А', rpm: '4510 об/мин' },
        { n: 'Блок питания', v: '28 В', t: '35 °C', c: '4,1 А', rpm: '—' },
        { n: 'Бортовой компьютер', v: '5 В', t: '41 °C', c: '0,8 А', rpm: '—' },
      ];
      const bad = R.int(0, 2);
      mods[bad] = Object.assign({}, mods[bad], { t: '87 °C', c: '3,9 А', rpm: '2210 об/мин' });
      const order = shuffle(mods.map((m, i) => i));
      root.innerHTML = '';
      api.hint('Стыковка завершена! Теперь проверим телеметрию. Один модуль работает с отклонениями — найдите и замените его. Норма для маховиков: 25–45 °C, ток до 1,5 А, около 4500 об/мин.');
      const el = h(`<div><div class="stage-title"><h3>Этап 2: диагностика</h3>${setSteps(1)}</div>
        <div class="card"><p>Нажмите на строку неисправного модуля, чтобы заменить его на запасной.</p>
        <table class="data"><thead><tr><th>Модуль</th><th>Напряжение</th><th>Температура</th><th>Ток</th><th>Обороты</th></tr></thead>
        <tbody>${order.map((i) => `<tr class="pick" data-i="${i}"><td>${mods[i].n}</td><td>${mods[i].v}</td><td>${mods[i].t}</td><td>${mods[i].c}</td><td>${mods[i].rpm}</td></tr>`).join('')}</tbody></table>
        <p class="small muted">Попыток: <b class="tries">0</b></p></div></div>`);
      root.appendChild(el);
      let tries = 0;
      el.addEventListener('click', (e) => {
        const tr = e.target.closest('[data-i]'); if (!tr) return;
        tries++; $('.tries', el).textContent = tries;
        if (+tr.dataset.i === bad) {
          svc.diag = clamp(100 - (tries - 1) * 40, 0, 100);
          details.push(`Диагностика: неисправный «${mods[bad].n}» найден ${tries === 1 ? 'с первой попытки' : `за ${tries} попытки`}`);
          tr.querySelectorAll('td').forEach((td) => { td.style.background = 'rgba(79,224,138,.2)'; });
          S.timeout(refuel, 900);
        } else { tr.querySelectorAll('td').forEach((td) => { td.style.background = 'rgba(255,93,108,.2)'; }); }
      });
    }

    function refuel() {
      root.innerHTML = '';
      api.hint('Дозаправка гидразином. Удерживайте кнопку, чтобы качать топливо, и отпустите, когда уровень будет в зелёной зоне 85–95%. Насос разгоняется — не переполните бак!');
      const el = h(`<div><div class="stage-title"><h3>Этап 3: дозаправка</h3>${setSteps(2)}</div>
        <div class="card"><p>Уровень бака: <b class="lvl">12</b>% · давление: <b class="pr">4.0</b> бар</p>
        <div class="meter" style="height:28px"><div class="zone" style="left:85%;width:10%"></div><i style="width:12%"></i></div>
        <div class="row center" style="margin-top:14px"><button class="btn btn-primary big pump" style="touch-action:none">⛽ Удерживайте для подачи</button><button class="btn done-btn">Завершить дозаправку</button></div></div></div>`);
      root.appendChild(el);
      let lvl = 12, pumping = false, rate = 0, finished = false;
      const pump = $('.pump', el), bar = $('.meter i', el);
      S.on(pump, 'pointerdown', (e) => { e.preventDefault(); pumping = true; });
      S.on(window, 'pointerup', () => { pumping = false; rate = 0; });
      S.on(pump, 'pointerleave', () => { pumping = false; rate = 0; });
      S.raf((dt) => {
        if (finished) return false;
        if (pumping) { rate = Math.min(rate + dt * 9, 30); lvl += rate * dt; }
        $('.lvl', el).textContent = fmt(Math.min(lvl, 100), 1);
        $('.pr', el).textContent = fmt(4 + lvl * 0.18, 1);
        bar.style.width = `${Math.min(lvl, 100)}%`;
        bar.style.background = lvl > 100 ? '#ff5d6c' : lvl >= 85 && lvl <= 95 ? '#4fe08a' : '#4ea3ff';
        if (lvl > 100) end();
      });
      const end = () => {
        if (finished) return; finished = true;
        if (lvl > 100) { svc.fuel = 10; details.push('<span class="bad">Дозаправка: переполнение бака, сработал аварийный клапан</span>'); }
        else if (lvl >= 85 && lvl <= 95) { svc.fuel = 100 - Math.abs(90 - lvl) * 4; details.push(`Дозаправка: уровень ${fmt(lvl, 1)}% — в норме`); }
        else { svc.fuel = clamp(100 - Math.abs(90 - lvl) * 4, 0, 70); details.push(`Дозаправка: уровень ${fmt(lvl, 1)}% — ${lvl < 85 ? 'недолив' : 'перелив'}`); }
        S.timeout(antenna, 700);
      };
      $('.done-btn', el).addEventListener('click', end);
    }

    function antenna() {
      root.innerHTML = '';
      const ta = R.range(-50, 50), te = R.range(10, 70);
      api.hint('Последний шаг — калибровка остронаправленной антенны. Подбирайте азимут и угол места так, чтобы сигнал наземной станции был максимальным (≥ 90%).');
      const el = h(`<div><div class="stage-title"><h3>Этап 4: калибровка антенны</h3>${setSteps(3)}</div>
        <div class="card"><div class="kv"><span>Азимут</span><input type="range" min="-90" max="90" step="0.5" value="0" class="az"><span>Угол места</span><input type="range" min="0" max="90" step="0.5" value="45" class="el"></div>
        <p style="margin-top:14px">Уровень сигнала: <b class="sig">0</b>%</p><div class="meter" style="height:24px"><div class="zone" style="left:90%;width:10%"></div><i></i></div>
        <div class="row center" style="margin-top:14px"><button class="btn btn-primary fix">📡 Зафиксировать положение</button></div></div></div>`);
      root.appendChild(el);
      const az = $('.az', el), elv = $('.el', el), bar = $('.meter i', el);
      let sig = 0;
      const upd = () => {
        const d2 = ((+az.value - ta) / 22) ** 2 + ((+elv.value - te) / 16) ** 2;
        sig = 100 * Math.exp(-d2) * (0.97 + Math.random() * 0.03);
        $('.sig', el).textContent = fmt(sig, 0); bar.style.width = `${sig}%`; bar.style.background = sig >= 90 ? '#4fe08a' : '#4ea3ff';
      };
      az.addEventListener('input', upd); elv.addEventListener('input', upd); upd();
      $('.fix', el).addEventListener('click', () => {
        svc.ant = clamp(sig + 5, 0, 100);
        details.push(`Антенна: уровень сигнала ${fmt(sig, 0)}%`);
        const serviceScore = (svc.diag + svc.fuel + svc.ant) / 3;
        api.finish(dockScore * 0.5 + serviceScore * 0.5, details);
      });
    }
  }

  Missions.register({
    id: 'docking', role: 'scientist', cat: 'orbit', icon: '🛰', title: 'Стыковка и обслуживание',
    short: 'Удалённо состыковать сервисный аппарат со спутником и обслужить его',
    facts: [
      'Грузовые корабли (Прогресс, Dragon, Тяньчжоу) стыкуются со станциями автоматически, но операторы всегда готовы взять управление.',
      'Сервисные аппараты, например MEV-1, уже стыковались с геостационарными спутниками и продлевали им жизнь на годы.',
      'Скорость касания при стыковке — всего несколько сантиметров в секунду.',
    ],
    briefing: [
      'Учёный, у нас срочная задача. Спутник связи на орбите теряет ориентацию — его нужно обслужить.',
      'Вы будете удалённо управлять сервисным аппаратом, глядя через его стыковочную камеру. Нужно состыковаться <b>ровно</b>: без смещения, без крена и на очень малой скорости.',
      'Правило оператора: чем ближе к цели, тем медленнее. Помните, двигатели работают по инерции — каждый импульс нужно гасить встречным.',
      'После захвата проведём обслуживание: диагностику модулей, дозаправку и калибровку антенны.',
    ],
    controls: '<b>Стрелки</b> — боковое смещение, <b>W/S</b> — вперёд/назад, <b>Q/E</b> — крен. Далее — мышью.',
    start,
  });
})();
