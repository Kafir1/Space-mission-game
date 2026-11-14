'use strict';
/* Миссия 2. Выход в открытый космос: замена батареи, монтаж камеры, ремонт разъёма */
(function () {
  const W = 960, H = 540;
  const HATCH = { x: 480, y: 357 };
  const POINTS = {
    hatch: { x: 480, y: 372, label: 'Шлюз' },
    battery: { x: 800, y: 318, label: 'Блок батарей' },
    mount: { x: 300, y: 312, label: 'Платформа ELC' },
    repair: { x: 150, y: 318, label: 'Разъём панели' },
  };
  const RECTS = [
    { x: 70, y: 255, w: 820, h: 30 },   // ферма
    { x: 390, y: 285, w: 180, h: 70 },  // модуль
    { x: 775, y: 285, w: 50, h: 18 },   // батарейный блок
    { x: 280, y: 285, w: 40, h: 12 },   // платформа
  ];
  const TETHER = 410;

  function start(root, api) {
    const S = api.scope;
    const keys = S.trackKeys();
    root.innerHTML = '';
    const wrap = h(`<div><div class="canvas-wrap"><canvas class="game-canvas" width="${W}" height="${H}"></canvas></div></div>`);
    root.appendChild(wrap);
    wrap.appendChild(touchControls(S, [
      [{ label: '◀', code: 'ArrowLeft' }, { label: '▲', code: 'ArrowUp' }, { label: '▼', code: 'ArrowDown' }, { label: '▶', code: 'ArrowRight' }],
      [{ label: 'R фал', code: 'KeyR', wide: true }, { label: 'E действие', code: 'KeyE', wide: true }],
    ]));
    const cv = $('canvas', wrap), ctx = cv.getContext('2d');
    const cwrap = $('.canvas-wrap', wrap);
    api.hint('Стрелки/WASD — двигатели ранца SAFER (инерция сохраняется!). E — действие. R — подтянуться по страховочному фалу к шлюзу. Следите за кислородом и топливом.');

    const st = {
      x: HATCH.x, y: 395, vx: 0, vy: 0, o2: 100, fuel: 100, carry: null,
      battery: 0, equip: 0, repair: 0, impacts: 0, mistakes: 0, t: 0, paused: false, over: false, msg: '', msgT: 0,
    };
    const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * 300, r: Math.random() * 1.3 }));
    const collides = (x, y) => RECTS.some((r) => x > r.x - 12 && x < r.x + r.w + 12 && y > r.y - 12 && y < r.y + r.h + 12);
    const say = (m) => { st.msg = m; st.msgT = 3; };
    const tasksDone = () => (st.battery === 3) + (st.equip === 2) + (st.repair === 1);

    function nearPoint() {
      for (const [k, p] of Object.entries(POINTS)) if (dist(st.x, st.y, p.x, p.y) < 38) return k;
      return null;
    }
    function actionText(k) {
      if (k === 'battery') { if (st.battery === 0 && !st.carry) return 'снять старую батарею'; if (st.battery === 2 && st.carry === 'new') return 'установить новую батарею'; }
      if (k === 'hatch') {
        if (st.carry === 'old') return 'сдать старую батарею и взять новую';
        if (!st.carry && st.equip === 0) return 'взять камеру высокого разрешения';
        if (!st.carry && tasksDone() === 3) return 'вернуться в шлюз и завершить выход';
      }
      if (k === 'mount' && st.carry === 'cam' && st.equip === 1) return 'смонтировать камеру';
      if (k === 'repair' && st.repair === 0) return 'отремонтировать разъём';
      return null;
    }
    function act() {
      if (st.paused || st.over) return;
      const k = nearPoint(); if (!k || !actionText(k)) return;
      if (k === 'battery') {
        if (st.battery === 0) { st.battery = 1; st.carry = 'old'; say('Старая батарея снята. Отнесите её к шлюзу.'); } else { st.battery = 3; st.carry = null; say('Новая литий-ионная батарея установлена! ✅'); }
      } else if (k === 'hatch') {
        if (st.carry === 'old') { st.carry = 'new'; st.battery = 2; say('Новая батарея получена. Установите её в блок.'); } else if (st.equip === 0) { st.carry = 'cam'; st.equip = 1; say('Камера у вас. Её место — на платформе ELC.'); } else finish(false);
      } else if (k === 'mount') alignGame();
      else if (k === 'repair') wireGame();
    }
    S.on(window, 'keydown', (e) => { if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') act(); });

    // Мини-игра: соединение проводов
    function wireGame() {
      st.paused = true;
      const colors = ['#ff4d4d', '#ffd23f', '#3fa7ff', '#4fe08a'];
      const right = shuffle(colors);
      let sel = null, done = 0;
      const ov = h(`<div class="overlay"><div class="card"><h4>Ремонт разъёма солнечной панели</h4><p class="small">Повреждённый кабель нужно перекоммутировать: соедините провода одинакового цвета. Нажмите провод слева, затем справа.</p>
        <div class="wires"><div class="wire-col l">${colors.map((c, i) => `<div class="wire" data-l="${i}" style="background:${c}"></div>`).join('')}</div>
        <div class="wire-col r">${right.map((c, i) => `<div class="wire" data-r="${i}" style="background:${c}"></div>`).join('')}</div></div>
        <div class="small muted">Ошибок: <b class="err">0</b></div></div></div>`);
      cwrap.appendChild(ov);
      let errs = 0;
      ov.addEventListener('click', (e) => {
        const l = e.target.closest('[data-l]'), r = e.target.closest('[data-r]');
        if (l && !l.classList.contains('done')) { $$('[data-l]', ov).forEach((x) => x.classList.remove('sel')); sel = l; l.classList.add('sel'); }
        if (r && sel && !r.classList.contains('done')) {
          if (colors[+sel.dataset.l] === right[+r.dataset.r]) { sel.classList.add('done'); r.classList.add('done'); sel.classList.remove('sel'); sel = null; done++; } else { errs++; st.mistakes++; $('.err', ov).textContent = errs; }
          if (done === 4) { ov.remove(); st.repair = 1; st.paused = false; say('Разъём восстановлен, панель снова даёт ток! ✅'); }
        }
      });
    }
    // Мини-игра: выравнивание крепления
    let align = null;
    function alignGame() {
      st.paused = true;
      align = { t: 0, hits: 0 };
      say('Зафиксируйте камеру: нажмите E, когда стрелка в зелёной зоне (нужно 3 раза).');
    }
    S.on(window, 'keydown', (e) => {
      if (!align || !(e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) return;
      const ang = Math.sin(align.t * 2.6) * 80;
      if (Math.abs(ang) < 12) { align.hits++; if (align.hits >= 3) { align = null; st.equip = 2; st.carry = null; st.paused = false; say('Камера смонтирована и подключена! ✅'); } } else { st.mistakes++; say('Мимо! Крепление не встало в паз.'); }
      e.stopImmediatePropagation();
    }, true);

    function finish(emergency) {
      if (st.over) return; st.over = true;
      const done = tasksDone();
      let score = (done / 3) * 60 + (st.o2 / 100) * 20 + (st.fuel / 100) * 10 + 10 - 5 * (st.impacts + st.mistakes);
      if (emergency) score *= 0.6;
      const d = [
        `Выполнено задач: <b>${done}/3</b> (батарея: ${st.battery === 3 ? '✅' : '❌'}, камера: ${st.equip === 2 ? '✅' : '❌'}, ремонт: ${st.repair ? '✅' : '❌'})`,
        `Остаток кислорода: ${Math.round(st.o2)}%, топлива SAFER: ${Math.round(st.fuel)}%`,
        `Столкновения со станцией: ${st.impacts}, ошибки при работе: ${st.mistakes}`,
        `Длительность выхода: ${Math.round(st.t)} с`,
      ];
      if (emergency) d.unshift('<span class="bad">Кислород закончился — аварийное возвращение по фалу.</span>');
      S.timeout(() => api.finish(score, d), 700);
    }

    S.raf((dt) => {
      if (st.over) { draw(); return; }
      st.t += dt; st.o2 -= dt * 100 / 300; st.msgT -= dt;
      if (st.o2 <= 0) { st.o2 = 0; finish(true); }
      if (align) align.t += dt;
      if (!st.paused) {
        const a = st.carry ? 32 : 45;
        let ax = 0, ay = 0;
        if (keys.ArrowLeft || keys.KeyA) ax -= 1; if (keys.ArrowRight || keys.KeyD) ax += 1;
        if (keys.ArrowUp || keys.KeyW) ay -= 1; if (keys.ArrowDown || keys.KeyS) ay += 1;
        if ((ax || ay) && st.fuel > 0) { st.vx += ax * a * dt; st.vy += ay * a * dt; st.fuel = Math.max(0, st.fuel - dt * 2.5); }
        if (keys.KeyR) { const d = dist(st.x, st.y, HATCH.x, HATCH.y + 30) || 1; st.vx += ((HATCH.x - st.x) / d) * 30 * dt; st.vy += ((HATCH.y + 30 - st.y) / d) * 30 * dt; }
        const sp = Math.hypot(st.vx, st.vy); if (sp > 130) { st.vx *= 130 / sp; st.vy *= 130 / sp; }
        // фал
        const td = dist(st.x, st.y, HATCH.x, HATCH.y);
        if (td > TETHER) { const nx = (st.x - HATCH.x) / td, ny = (st.y - HATCH.y) / td; const vr = st.vx * nx + st.vy * ny; if (vr > 0) { st.vx -= vr * nx * 1.6; st.vy -= vr * ny * 1.6; } st.vx -= nx * 20 * dt; st.vy -= ny * 20 * dt; }
        const nx = st.x + st.vx * dt;
        if (collides(nx, st.y)) { if (Math.abs(st.vx) > 45) { st.impacts++; say('Удар о конструкцию! Осторожнее.'); } st.vx = -st.vx * 0.3; } else st.x = nx;
        const ny = st.y + st.vy * dt;
        if (collides(st.x, ny)) { if (Math.abs(st.vy) > 45) { st.impacts++; say('Удар о конструкцию! Осторожнее.'); } st.vy = -st.vy * 0.3; } else st.y = ny;
        st.x = clamp(st.x, 14, W - 14); st.y = clamp(st.y, 14, H - 14);
      }
      draw();
    });

    function draw() {
      ctx.fillStyle = '#02040b'; ctx.fillRect(0, 0, W, H);
      stars.forEach((s) => { ctx.fillStyle = '#cdd8ff'; ctx.fillRect(s.x, s.y, s.r, s.r); });
      // Земля
      const eg = ctx.createRadialGradient(480, 1500, 1000, 480, 1500, 1120);
      eg.addColorStop(0, '#1a5fb4'); eg.addColorStop(0.9, '#3b8fe0'); eg.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(480, 1500, 1120, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(((i * 170 + st.t * 6) % 1200) - 100, 470 + (i % 3) * 18, 70, 10, 0, 0, 7); ctx.fill(); }
      // солнечные панели
      const panel = (x, y, w, hh, damaged) => {
        ctx.fillStyle = '#1b3a78'; ctx.fillRect(x, y, w, hh);
        ctx.strokeStyle = '#5d86d6'; ctx.lineWidth = 1;
        for (let yy = y; yy < y + hh; yy += 14) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + hh); ctx.stroke();
        if (damaged) { ctx.fillStyle = 'rgba(255,80,80,.35)'; ctx.fillRect(x, y + hh - 60, w, 60); }
      };
      panel(90, 30, 46, 222, false); panel(90, 288, 46, 222, st.repair === 0);
      panel(824, 30, 46, 222, false); panel(824, 288, 46, 222, false);
      // ферма
      ctx.fillStyle = '#9aa3b5'; ctx.fillRect(70, 255, 820, 30);
      ctx.strokeStyle = '#5f6778'; ctx.lineWidth = 2;
      for (let x = 70; x < 880; x += 30) { ctx.beginPath(); ctx.moveTo(x, 255); ctx.lineTo(x + 30, 285); ctx.moveTo(x + 30, 255); ctx.lineTo(x, 285); ctx.stroke(); }
      // модуль
      const mg = ctx.createLinearGradient(0, 285, 0, 355); mg.addColorStop(0, '#e6e9ef'); mg.addColorStop(1, '#a4abb8');
      ctx.fillStyle = mg; ctx.fillRect(390, 285, 180, 70);
      ctx.fillStyle = '#5b6273'; ctx.fillRect(462, 345, 36, 12);
      ctx.fillStyle = '#334'; ctx.font = '12px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText('МОДУЛЬ «КВЕСТ»', 480, 325);
      // блок батарей
      ctx.fillStyle = st.battery === 3 ? '#4fe08a' : st.battery === 0 ? '#d89a3a' : '#333'; ctx.fillRect(775, 285, 50, 18);
      // платформа
      ctx.fillStyle = '#c4c9d4'; ctx.fillRect(280, 285, 40, 12);
      if (st.equip === 2) { ctx.fillStyle = '#222'; ctx.fillRect(290, 297, 20, 14); ctx.fillStyle = '#4ea3ff'; ctx.beginPath(); ctx.arc(300, 311, 4, 0, 7); ctx.fill(); }
      // разъём
      ctx.fillStyle = st.repair ? '#4fe08a' : (Math.sin(st.t * 8) > 0 ? '#ff5d6c' : '#662'); ctx.fillRect(140, 285, 20, 10);
      // фал
      ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(HATCH.x, HATCH.y);
      const mx = (HATCH.x + st.x) / 2, my = (HATCH.y + st.y) / 2 + Math.max(0, 60 - dist(HATCH.x, HATCH.y, st.x, st.y) / 8);
      ctx.quadraticCurveTo(mx, my, st.x, st.y); ctx.stroke();
      // маркеры
      const near = nearPoint();
      for (const [k, p] of Object.entries(POINTS)) {
        if (!actionText(k) && k !== near) continue;
        const pend = !!actionText(k);
        ctx.strokeStyle = pend ? `rgba(124,240,208,${0.5 + 0.4 * Math.sin(st.t * 4)})` : 'rgba(150,150,150,.4)';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 7); ctx.stroke();
        ctx.fillStyle = '#cfe'; ctx.font = '12px "Exo 2"'; ctx.fillText(p.label, p.x, p.y + 40);
      }
      // астронавт
      ctx.save(); ctx.translate(st.x, st.y);
      ctx.fillStyle = '#c9ccd4'; ctx.fillRect(-12, -10, 8, 22);
      ctx.fillStyle = '#f4f5f8'; ctx.beginPath(); ctx.arc(2, 0, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#d8a73a'; ctx.beginPath(); ctx.ellipse(6, -2, 7, 6, 0, 0, 7); ctx.fill();
      if (st.carry) { ctx.fillStyle = st.carry === 'cam' ? '#222' : st.carry === 'old' ? '#d89a3a' : '#4fe08a'; ctx.fillRect(10, 6, 16, 10); }
      const flame = (keys.ArrowLeft || keys.KeyA || keys.ArrowRight || keys.KeyD || keys.ArrowUp || keys.KeyW || keys.ArrowDown || keys.KeyS) && st.fuel > 0 && !st.paused;
      if (flame) { ctx.fillStyle = 'rgba(180,220,255,.8)'; ctx.beginPath(); ctx.arc(-14, 8, 3 + Math.random() * 2, 0, 7); ctx.fill(); }
      ctx.restore();
      // HUD
      ctx.textAlign = 'left';
      const bar = (x, y, label, v, col) => { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y, 170, 20); ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, 166 * v / 100, 16); ctx.fillStyle = '#fff'; ctx.font = '12px "Exo 2"'; ctx.fillText(`${label} ${Math.round(v)}%`, x + 6, y + 14); };
      bar(12, 10, 'O₂', st.o2, st.o2 < 25 ? '#ff5d6c' : '#3a9cff');
      bar(12, 34, 'Топливо', st.fuel, '#d89a3a');
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W - 262, 10, 250, 78);
      ctx.fillStyle = '#fff'; ctx.font = '13px "Exo 2"';
      ctx.fillText(`${st.battery === 3 ? '✅' : '⬜'} Заменить батарею`, W - 250, 30);
      ctx.fillText(`${st.equip === 2 ? '✅' : '⬜'} Смонтировать камеру`, W - 250, 50);
      ctx.fillText(`${st.repair ? '✅' : '⬜'} Починить разъём панели`, W - 250, 70);
      const at = near && actionText(near);
      if (at && !st.paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 200, H - 44, 400, 30); ctx.fillStyle = '#7cf0d0'; ctx.textAlign = 'center'; ctx.fillText(`E — ${at}`, W / 2, H - 24); }
      else if (tasksDone() === 3 && !st.over) { ctx.fillStyle = '#7cf0d0'; ctx.textAlign = 'center'; ctx.fillText('Все задачи выполнены — возвращайтесь к шлюзу!', W / 2, H - 24); }
      if (st.msgT > 0) { ctx.fillStyle = 'rgba(10,20,40,.85)'; ctx.textAlign = 'center'; ctx.fillRect(W / 2 - 260, 60, 520, 30); ctx.fillStyle = '#fff'; ctx.fillText(st.msg, W / 2, 80); }
      if (align) {
        const ang = Math.sin(align.t * 2.6) * 80;
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(W / 2 - 150, 140, 300, 190);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(W / 2, 290, 100, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        ctx.strokeStyle = '#4fe08a'; ctx.beginPath(); ctx.arc(W / 2, 290, 100, Math.PI * 1.5 - 0.21, Math.PI * 1.5 + 0.21); ctx.stroke();
        const ra = (ang - 90) * Math.PI / 180;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, 290); ctx.lineTo(W / 2 + Math.cos(ra) * 105, 290 + Math.sin(ra) * 105); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`Фиксация крепления: ${align.hits}/3`, W / 2, 165);
      }
      ctx.textAlign = 'left';
    }
  }

  Missions.register({
    id: 'spacewalk', role: 'pilot', cat: 'orbit', icon: '🧑‍🚀', title: 'Выход в открытый космос',
    short: 'Ремонт станции, монтаж оборудования, замена батарей',
    facts: [
      'Выход в открытый космос длится в среднем 6–7 часов. Астронавт всегда пристёгнут страховочным фалом.',
      'На МКС старые никель-водородные батареи заменили на литий-ионные — для этого понадобилась серия выходов.',
      'Ранец SAFER — аварийная система с маленькими двигателями на азоте, позволяет вернуться к станции.',
      'В невесомости нет трения: разогнавшись, вы будете лететь, пока не затормозите двигателем.',
    ],
    briefing: [
      'Пилот, сегодня у вас выход в открытый космос. Это одна из самых ответственных работ на станции.',
      'План такой: <b>заменить батарею</b> на ферме — снять старую, отнести к шлюзу, забрать новую и установить. Затем <b>смонтировать камеру</b> на платформе ELC и <b>починить разъём</b> повреждённой солнечной панели.',
      'Помните про невесомость: импульс двигателя сохраняется, поэтому тормозите заранее. Удары о станцию опасны. Если закончится топливо — подтягивайтесь по фалу.',
      'Кислорода в скафандре хватит примерно на 5 минут игрового времени. Удачи, и не забудьте вернуться в шлюз!',
    ],
    controls: '<b>Стрелки / WASD</b> — двигатели ранца, <b>E / Пробел</b> — действие, <b>R</b> — подтянуться по фалу. На телефоне — экранные кнопки.',
    start,
  });
})();
