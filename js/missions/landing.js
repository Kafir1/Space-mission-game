'use strict';
/* Миссия 6. Высадка на поверхность Луны: посадка, образцы, приборы, поиск льда */
(function () {
  const W = 960, H = 540;
  const ROCKS = {
    basalt: { name: 'Базальт', color: '#3d3c3f', note: 'Тёмная застывшая лава лунных морей.' },
    anorth: { name: 'Анортозит', color: '#d9d6cc', note: 'Светлая порода древней лунной коры.' },
    breccia: { name: 'Брекчия', color: '#8c857a', note: 'Обломки, спаянные ударами метеоритов.' },
    glass: { name: 'Оранжевое стекло', color: '#d9792b', note: 'Бусинки вулканического стекла — редкая находка!' },
  };

  function start(root, api) {
    const S = api.scope;
    const keys = S.trackKeys();
    const details = [];
    const sc = { land: 0, samples: 0, instr: 0, ice: 0 };
    root.innerHTML = '';
    const el = h(`<div><div class="stage-title"><h3 class="ttl">Этап 1: посадка у южного полюса</h3><div class="steps"><span class="step on s0">Посадка</span><span class="step s1">Работа на поверхности</span></div></div>
      <div class="canvas-wrap"><canvas class="game-canvas" width="${W}" height="${H}"></canvas></div></div>`);
    root.appendChild(el);
    el.appendChild(touchControls(S, [
      [{ label: '◀', code: 'ArrowLeft' }, { label: '▲', code: 'ArrowUp' }, { label: '▼', code: 'ArrowDown' }, { label: '▶', code: 'ArrowRight' }],
      [{ label: 'E действие', code: 'KeyE', wide: true }, { label: 'F бур', code: 'KeyF', wide: true }],
    ]));
    const cv = $('canvas', el), ctx = cv.getContext('2d');

    /* ---------- Посадка ---------- */
    let crashes = 0;
    function lander() {
      api.hint('▲ — главный двигатель, ◀▶ — поворот. Сядьте на зелёную площадку: вертикальная скорость меньше 2 м/с, горизонтальная — меньше 1,5 м/с, наклон — меньше 8°. Следите за топливом!');
      const r = rng(Math.floor(Math.random() * 1e9));
      const padX = r.range(480, 800), padW = 100;
      const terr = [];
      for (let x = 0; x <= W; x += 24) {
        let y = 420 + Math.sin(x * 0.013) * 40 + Math.sin(x * 0.041) * 18 + r.range(-12, 12);
        if (x >= padX - 10 && x <= padX + padW + 10) y = 440;
        terr.push([x, y]);
      }
      const groundAt = (x) => { const i = clamp(Math.floor(x / 24), 0, terr.length - 2); const [x0, y0] = terr[i], [x1, y1] = terr[i + 1]; return lerp(y0, y1, (x - x0) / (x1 - x0)); };
      const s = { x: 480, y: 50, vx: 30, vy: 0, a: -20, fuel: 100, t: 0, done: false, msg: '' };
      const G = 8, T = 20;
      S.raf((dt) => {
        if (s.done) return false;
        s.t += dt;
        if (keys.ArrowLeft || keys.KeyA) s.a -= 90 * dt;
        if (keys.ArrowRight || keys.KeyD) s.a += 90 * dt;
        s.a = clamp(s.a, -90, 90);
        const thrust = (keys.ArrowUp || keys.KeyW || keys.Space) && s.fuel > 0;
        if (thrust) { const ra = (s.a * Math.PI) / 180; s.vx += Math.sin(ra) * T * dt; s.vy -= Math.cos(ra) * T * dt; s.fuel = Math.max(0, s.fuel - 5 * dt); }
        s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < 10) { s.x = 10; s.vx = Math.abs(s.vx) * 0.3; } if (s.x > W - 10) { s.x = W - 10; s.vx = -Math.abs(s.vx) * 0.3; }
        const gy = Math.min(groundAt(s.x - 14), groundAt(s.x + 14));
        if (s.y + 18 >= gy) {
          s.done = true; s.y = gy - 18;
          const vy = s.vy / 5, vx = Math.abs(s.vx) / 5, ang = Math.abs(s.a);
          const onPad = s.x - 14 >= padX && s.x + 14 <= padX + padW;
          const soft = vy < 2 && vx < 1.5 && ang < 8;
          const survive = vy < 3.5 && vx < 3 && ang < 15 && (onPad || Math.abs(groundAt(s.x - 14) - groundAt(s.x + 14)) < 10);
          if (soft && onPad) {
            sc.land = clamp(70 + (s.fuel / 100) * 30 - crashes * 20, 10, 100);
            s.msg = 'Посадка выполнена! «Орёл» на площадке.';
            details.push(`Посадка: на площадке, скорость ${fmt(vy, 2)} м/с, остаток топлива ${Math.round(s.fuel)}%, неудачных попыток: ${crashes}`);
            draw(s, true); S.timeout(surface, 1800);
          } else if (survive) {
            sc.land = clamp(45 - crashes * 15, 5, 100);
            s.msg = 'Жёсткая посадка вне площадки, но корабль цел.';
            details.push(`Посадка: жёсткая/вне площадки (скорость ${fmt(vy, 2)} м/с, наклон ${fmt(ang, 0)}°)`);
            draw(s, true); S.timeout(surface, 1800);
          } else {
            crashes++;
            s.msg = crashes >= 3 ? 'Авария. Высадку выполнит резервный модуль.' : `Авария! (скорость ${fmt(vy, 1)} м/с, наклон ${fmt(ang, 0)}°). Повтор через 2 с…`;
            draw(s, false);
            if (crashes >= 3) { sc.land = 0; details.push('<span class="bad">Посадка: три аварии — высадка с резервного модуля</span>'); S.timeout(surface, 2200); } else S.timeout(lander, 2000);
          }
          return false;
        }
        draw(s);
      });
      function draw(st, landed) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 90; i++) { ctx.fillStyle = '#aab'; ctx.fillRect((i * 211) % W, (i * 89) % 300, 1, 1); }
        ctx.fillStyle = '#3a6fc0'; ctx.beginPath(); ctx.arc(820, 90, 26, 0, 7); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(830, 84, 24, 0, 7); ctx.fill();
        ctx.fillStyle = '#6b6965'; ctx.beginPath(); ctx.moveTo(0, H); terr.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W, H); ctx.fill();
        ctx.fillStyle = '#4fe08a'; ctx.fillRect(padX, 438, padW, 4);
        ctx.save(); ctx.translate(st.x, st.y); ctx.rotate((st.a * Math.PI) / 180);
        const thrust = (keys.ArrowUp || keys.KeyW || keys.Space) && st.fuel > 0 && !st.done;
        if (thrust) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(6, 14); ctx.lineTo(0, 30 + Math.random() * 14); ctx.fill(); }
        ctx.fillStyle = '#d8b04a'; ctx.fillRect(-12, -2, 24, 14);
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-7, -16); ctx.lineTo(7, -16); ctx.lineTo(10, -2); ctx.fill();
        ctx.fillStyle = '#334'; ctx.fillRect(-4, -12, 8, 5);
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(-16, 18); ctx.moveTo(10, 10); ctx.lineTo(16, 18); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(10, 10, 280, 104);
        ctx.font = '14px "Exo 2"'; ctx.textAlign = 'left';
        const vy = st.vy / 5, vx = st.vx / 5;
        ctx.fillStyle = '#fff'; ctx.fillText(`Высота: ${fmt(Math.max(0, (groundAt(st.x) - st.y - 18) / 5), 0)} м`, 20, 32);
        ctx.fillStyle = vy < 2 ? '#4fe08a' : '#ffb547'; ctx.fillText(`Вертикальная скорость: ${fmt(vy, 1)} м/с`, 20, 54);
        ctx.fillStyle = Math.abs(vx) < 1.5 ? '#4fe08a' : '#ffb547'; ctx.fillText(`Горизонтальная: ${fmt(vx, 1)} м/с`, 20, 76);
        ctx.fillStyle = Math.abs(st.a) < 8 ? '#4fe08a' : '#ffb547'; ctx.fillText(`Наклон: ${fmt(st.a, 0)}°`, 20, 98);
        ctx.fillStyle = '#222'; ctx.fillRect(300, 14, 160, 16); ctx.fillStyle = st.fuel < 20 ? '#ff5d6c' : '#d89a3a'; ctx.fillRect(300, 14, st.fuel * 1.6, 16);
        ctx.fillStyle = '#fff'; ctx.fillText(`Топливо ${Math.round(st.fuel)}%`, 310, 27);
        if (st.msg) { ctx.fillStyle = landed === false ? 'rgba(80,10,10,.85)' : 'rgba(10,60,30,.85)'; ctx.fillRect(W / 2 - 280, 200, 560, 44); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 17px "Exo 2"'; ctx.fillText(st.msg, W / 2, 228); }
      }
    }

    /* ---------- Работа на поверхности ---------- */
    function surface() {
      $('.ttl', el).textContent = 'Этап 2: работа на поверхности';
      $('.s0', el).className = 'step done s0'; $('.s1', el).className = 'step on s1';
      api.hint('Задачи: собрать 4 разных образца (подходите к камням — сканер покажет тип), установить сейсмометр дальше 300 м от модуля и не в кратере, установить лазерный отражатель и навести его на Землю, найти лёд в тёмном кратере (нейтронный счётчик + бур F). Вернитесь к модулю и нажмите E, чтобы закончить.');
      const MW = 2000, MH = 1300;
      const r = rng(Math.floor(Math.random() * 1e9));
      const tex = window.MoonArt.moonTexture(MW, MH, 4242);
      const LANDER = { x: 380, y: 380 };
      const PSR = { x: 1650, y: 1000, r: 230 };
      const ice = { x: PSR.x + r.range(-120, 120), y: PSR.y + r.range(-120, 120) };
      const bigCraters = [{ x: 900, y: 300, r: 90 }, { x: 600, y: 900, r: 110 }, { x: 1350, y: 520, r: 80 }];
      const tctx = tex.getContext('2d');
      bigCraters.forEach((c) => window.MoonArt.drawCrater(tctx, c.x, c.y, c.r));
      const types = shuffle(['basalt', 'basalt', 'basalt', 'anorth', 'anorth', 'anorth', 'breccia', 'breccia', 'breccia', 'glass'], r);
      const rocks = types.map((t) => {
        let x, y;
        do { x = r.range(100, MW - 100); y = r.range(100, MH - 100); } while (dist(x, y, LANDER.x, LANDER.y) < 150 || dist(x, y, PSR.x, PSR.y) < PSR.r + 30);
        return { x, y, t, taken: false, rr: r.range(8, 13) };
      });
      const s = { x: LANDER.x + 60, y: LANDER.y + 40, vx: 0, vy: 0, hop: 0, power: 100, bag: [], carry: null, instrLeft: ['seis', 'refl'], seis: null, refl: null, aim: null, drills: 3, iceFound: false, drillMarks: [], msg: '', msgT: 0, over: false, t: 0 };
      const say = (m, t = 3) => { s.msg = m; s.msgT = t; };
      const inPSR = () => dist(s.x, s.y, PSR.x, PSR.y) < PSR.r;

      const prompt = () => {
        if (s.aim) return null;
        if (dist(s.x, s.y, LANDER.x, LANDER.y) < 60) {
          if (!s.carry && s.instrLeft.length) return `взять ${s.instrLeft[0] === 'seis' ? 'сейсмометр' : 'лазерный отражатель'}`;
          if (!s.carry) return 'вернуться в модуль и завершить выход';
        }
        if (s.carry) return `установить ${s.carry === 'seis' ? 'сейсмометр' : 'отражатель'} здесь`;
        const rock = nearRock();
        if (rock) return s.bag.length < 4 ? `взять образец: ${ROCKS[rock.t].name}` : 'контейнер полон (4/4)';
        return null;
      };
      const nearRock = () => rocks.find((k) => !k.taken && dist(s.x, s.y, k.x, k.y) < 34);

      S.on(window, 'keydown', (e) => {
        if (s.over) return;
        if (s.aim) {
          if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
            const diff = Math.abs(((s.aim.a - s.aim.target + 540) % 360) - 180);
            s.refl.q = clamp(100 - diff * 6, 0, 100); s.refl.a = s.aim.a;
            say(diff < 5 ? 'Отражатель точно наведён на Землю! ✅' : `Отражатель установлен, отклонение ${fmt(diff, 1)}°.`);
            s.aim = null;
          }
          return;
        }
        if (e.code === 'KeyF') {
          if (!inPSR()) { say('Бурить стоит только в постоянно затенённом кратере — там может быть лёд.'); return; }
          if (s.iceFound || s.drills <= 0) return;
          s.drills--; s.power -= 4;
          const d = dist(s.x, s.y, ice.x, ice.y);
          s.drillMarks.push({ x: s.x, y: s.y, ok: d < 50 });
          if (d < 50) { s.iceFound = true; say('💧 Есть лёд! Керн содержит ~5% водяного льда. Образец сохранён.', 4); }
          else say(`Льда нет. Осталось бурений: ${s.drills}. Ориентируйтесь на нейтронный счётчик.`);
          return;
        }
        if (!(e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) return;
        const p = prompt(); if (!p) return;
        if (dist(s.x, s.y, LANDER.x, LANDER.y) < 60 && !s.carry) {
          if (s.instrLeft.length) { s.carry = s.instrLeft.shift(); say(s.carry === 'seis' ? 'Сейсмометр взят. Нужно место дальше 300 м от модуля (вибрации!) и не в кратере.' : 'Отражатель взят. Установите его подальше от модуля (>150 м), чтобы пыль от взлёта его не засыпала.'); } else end();
          return;
        }
        if (s.carry === 'seis') {
          const dl = dist(s.x, s.y, LANDER.x, LANDER.y);
          const inCr = bigCraters.find((c) => dist(s.x, s.y, c.x, c.y) < c.r);
          if (dl < 300) { say(`Слишком близко к модулю (${Math.round(dl)} м) — его вибрации будут мешать.`); return; }
          if (inCr) { say('Склон кратера неустойчив. Нужна ровная площадка.'); return; }
          s.seis = { x: s.x, y: s.y }; s.carry = null; say('Сейсмометр установлен и передаёт данные! ✅'); return;
        }
        if (s.carry === 'refl') {
          if (dist(s.x, s.y, LANDER.x, LANDER.y) < 150) { say('Слишком близко к модулю — при взлёте отражатель засыплет пылью.'); return; }
          s.refl = { x: s.x, y: s.y, q: 0 }; s.carry = null; s.aim = { a: r.range(0, 360), target: 37 };
          say('Наведите отражатель на Землю: ◀▶ — поворот, E — зафиксировать.', 5); return;
        }
        const rock = nearRock();
        if (rock && s.bag.length < 4) { rock.taken = true; s.bag.push(rock.t); say(`${ROCKS[rock.t].name}: ${ROCKS[rock.t].note}`); }
      });

      function end() {
        if (s.over) return; s.over = true;
        const uniq = new Set(s.bag).size;
        sc.samples = uniq * 25;
        sc.instr = (s.seis ? 50 : 0) + (s.refl ? s.refl.q / 2 : 0);
        sc.ice = s.iceFound ? 60 + s.drills * 20 : 0;
        details.push(`Образцы: ${s.bag.length} шт., разных типов: ${uniq}/4 (${s.bag.map((t) => ROCKS[t].name).join(', ') || '—'})`);
        details.push(`Сейсмометр: ${s.seis ? '✅ установлен' : '❌ не установлен'}; лазерный отражатель: ${s.refl ? `✅ точность наведения ${fmt(s.refl.q, 0)}%` : '❌ не установлен'}`);
        details.push(`Поиск водяного льда: ${s.iceFound ? `✅ найден (бурений: ${3 - s.drills})` : '❌ не найден'}`);
        details.push(`Остаток заряда скафандра: ${Math.round(Math.max(0, s.power))}%`);
        const total = sc.land * 0.25 + sc.samples * 0.25 + sc.instr * 0.25 + sc.ice * 0.25;
        S.timeout(() => api.finish(total, details), 800);
      }

      S.raf((dt) => {
        if (s.over) return false;
        s.t += dt; s.msgT -= dt;
        s.power -= dt * (inPSR() ? 0.9 : 0.33);
        if (s.power <= 0) { s.power = 0; say('Заряд скафандра на исходе — экстренное возвращение!'); end(); }
        if (s.aim) {
          if (keys.ArrowLeft || keys.KeyA) s.aim.a -= 50 * dt;
          if (keys.ArrowRight || keys.KeyD) s.aim.a += 50 * dt;
          s.aim.a = (s.aim.a + 360) % 360;
        } else {
          let ax = 0, ay = 0;
          if (keys.ArrowLeft || keys.KeyA) ax--; if (keys.ArrowRight || keys.KeyD) ax++;
          if (keys.ArrowUp || keys.KeyW) ay--; if (keys.ArrowDown || keys.KeyS) ay++;
          const sp = 110;
          s.vx = lerp(s.vx, ax * sp, dt * 2.5); s.vy = lerp(s.vy, ay * sp, dt * 2.5);
          s.x = clamp(s.x + s.vx * dt, 20, MW - 20); s.y = clamp(s.y + s.vy * dt, 20, MH - 20);
          if (ax || ay) s.hop += dt * 5;
        }
        draw();
      });

      function draw() {
        const camX = clamp(s.x - W / 2, 0, MW - W), camY = clamp(s.y - H / 2, 0, MH - H);
        ctx.drawImage(tex, camX, camY, W, H, 0, 0, W, H);
        ctx.save(); ctx.translate(-camX, -camY);
        // затенённый кратер
        const pg = ctx.createRadialGradient(PSR.x, PSR.y, PSR.r * 0.6, PSR.x, PSR.y, PSR.r + 30);
        pg.addColorStop(0, 'rgba(5,6,12,.96)'); pg.addColorStop(1, 'rgba(5,6,12,0)');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(PSR.x, PSR.y, PSR.r + 30, 0, 7); ctx.fill();
        // свет фонаря в кратере
        if (inPSR()) { const lg = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, 110); lg.addColorStop(0, 'rgba(200,210,255,.35)'); lg.addColorStop(1, 'rgba(200,210,255,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(s.x, s.y, 110, 0, 7); ctx.fill(); }
        s.drillMarks.forEach((m) => { ctx.strokeStyle = m.ok ? '#4fe08a' : '#ff5d6c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, 7); ctx.stroke(); });
        // посадочный модуль
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(LANDER.x + 14, LANDER.y + 30, 44, 14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#d8b04a'; ctx.fillRect(LANDER.x - 28, LANDER.y - 10, 56, 30);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(LANDER.x - 20, LANDER.y - 34, 40, 26);
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3; [[-28, 20, -42, 36], [28, 20, 42, 36]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(LANDER.x + a, LANDER.y + b); ctx.lineTo(LANDER.x + c, LANDER.y + d); ctx.stroke(); });
        ctx.strokeStyle = 'rgba(124,240,208,.25)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(LANDER.x, LANDER.y, 300, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        // камни
        rocks.forEach((k) => {
          if (k.taken) return;
          if (dist(k.x, k.y, PSR.x, PSR.y) < PSR.r) return;
          ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(k.x + 5, k.y + 4, k.rr, k.rr * 0.6, 0, 0, 7); ctx.fill();
          ctx.fillStyle = ROCKS[k.t].color; ctx.beginPath(); ctx.ellipse(k.x, k.y, k.rr, k.rr * 0.75, 0.4, 0, 7); ctx.fill();
          if (k.t === 'breccia') { ctx.fillStyle = '#ccc'; ctx.fillRect(k.x - 3, k.y - 2, 3, 3); ctx.fillStyle = '#333'; ctx.fillRect(k.x + 2, k.y + 1, 3, 3); }
          if (k.t === 'glass') { ctx.fillStyle = '#ffb55a'; ctx.beginPath(); ctx.arc(k.x - 2, k.y - 2, 2.5, 0, 7); ctx.fill(); }
        });
        // приборы
        if (s.seis) { ctx.fillStyle = '#c0c4cc'; ctx.beginPath(); ctx.arc(s.seis.x, s.seis.y, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#4fe08a'; ctx.fillRect(s.seis.x - 2, s.seis.y - 14, 4, 4); }
        if (s.refl) {
          const a = ((s.aim ? s.aim.a : (s.refl.a ?? 37)) * Math.PI) / 180;
          ctx.save(); ctx.translate(s.refl.x, s.refl.y); ctx.rotate(a);
          ctx.fillStyle = '#9fb4d6'; ctx.fillRect(-12, -9, 24, 18); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
          for (let i = -8; i <= 8; i += 6) { ctx.beginPath(); ctx.moveTo(i, -9); ctx.lineTo(i, 9); ctx.stroke(); }
          ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(20, 0); ctx.lineTo(12, 4); ctx.fill();
          ctx.restore();
        }
        // астронавт
        const hopY = Math.abs(Math.sin(s.hop)) * 8;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(s.x + 4, s.y + 12, 10, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#f3f4f7'; ctx.beginPath(); ctx.arc(s.x, s.y - hopY, 11, 0, 7); ctx.fill();
        ctx.fillStyle = '#d8a73a'; ctx.beginPath(); ctx.ellipse(s.x + 3, s.y - 3 - hopY, 6, 5, 0, 0, 7); ctx.fill();
        if (s.carry) { ctx.fillStyle = s.carry === 'seis' ? '#c0c4cc' : '#9fb4d6'; ctx.fillRect(s.x + 9, s.y - hopY, 12, 9); }
        ctx.restore();
        // мини-карта
        const mw = 200, mh = 130, mx = W - mw - 10, my = 10, kx = mw / MW, ky = mh / MH;
        ctx.fillStyle = 'rgba(0,8,20,.75)'; ctx.fillRect(mx, my, mw, mh);
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(mx + PSR.x * kx, my + PSR.y * ky, PSR.r * kx, 0, 7); ctx.fill();
        ctx.fillStyle = '#d8b04a'; ctx.fillRect(mx + LANDER.x * kx - 3, my + LANDER.y * ky - 3, 6, 6);
        if (s.seis) { ctx.fillStyle = '#4fe08a'; ctx.fillRect(mx + s.seis.x * kx - 2, my + s.seis.y * ky - 2, 4, 4); }
        if (s.refl) { ctx.fillStyle = '#9fb4d6'; ctx.fillRect(mx + s.refl.x * kx - 2, my + s.refl.y * ky - 2, 4, 4); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + s.x * kx, my + s.y * ky, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.strokeRect(mx + camX * kx, my + camY * ky, W * kx, H * ky);
        // HUD
        ctx.fillStyle = 'rgba(0,8,20,.78)'; ctx.fillRect(10, 10, 300, 128);
        ctx.font = '13px "Exo 2"'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
        ctx.fillStyle = '#222'; ctx.fillRect(20, 18, 160, 14); ctx.fillStyle = s.power < 25 ? '#ff5d6c' : '#3a9cff'; ctx.fillRect(20, 18, s.power * 1.6, 14);
        ctx.fillStyle = '#fff'; ctx.fillText(`Заряд скафандра ${Math.round(s.power)}%`, 190, 30);
        ctx.fillText(`${new Set(s.bag).size >= 4 ? '✅' : '⬜'} Образцы: ${s.bag.length}/4, типов ${new Set(s.bag).size}`, 20, 54);
        ctx.fillText(`${s.seis ? '✅' : '⬜'} Сейсмометр`, 20, 74);
        ctx.fillText(`${s.refl && !s.aim ? '✅' : '⬜'} Лазерный отражатель`, 20, 94);
        ctx.fillText(`${s.iceFound ? '✅' : '⬜'} Водяной лёд (бурений: ${s.drills})`, 20, 114);
        ctx.fillStyle = '#93a2c4'; ctx.fillText(`Дальность до модуля: ${Math.round(dist(s.x, s.y, LANDER.x, LANDER.y))} м`, 20, 132);
        // нейтронный счётчик
        const sig = Math.exp(-(dist(s.x, s.y, ice.x, ice.y) ** 2) / (2 * 160 * 160));
        if (dist(s.x, s.y, PSR.x, PSR.y) < PSR.r + 250) {
          ctx.fillStyle = 'rgba(0,8,20,.78)'; ctx.fillRect(10, 146, 300, 40);
          ctx.fillStyle = '#fff'; ctx.fillText('Нейтронный счётчик (водород):', 20, 162);
          ctx.fillStyle = '#222'; ctx.fillRect(20, 168, 280, 10); ctx.fillStyle = '#7cf0d0'; ctx.fillRect(20, 168, 280 * clamp(sig + (Math.random() - 0.5) * 0.04, 0, 1), 10);
        }
        const p = prompt();
        if (p) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(W / 2 - 220, H - 44, 440, 30); ctx.fillStyle = '#7cf0d0'; ctx.textAlign = 'center'; ctx.fillText(`E — ${p}`, W / 2, H - 24); }
        if (inPSR() && !s.iceFound && s.drills > 0) { ctx.fillStyle = '#7cf0d0'; ctx.textAlign = 'center'; ctx.fillText('F — пробурить грунт', W / 2, H - 54); }
        if (s.msgT > 0) { ctx.fillStyle = 'rgba(10,20,40,.88)'; ctx.fillRect(W / 2 - 330, 150, 660, 32); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(s.msg, W / 2, 171); }
        if (s.aim) {
          ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(W / 2 - 160, H / 2 - 110, 320, 220);
          const cx = W / 2, cy = H / 2 + 10;
          ctx.strokeStyle = '#334'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 80, 0, 7); ctx.stroke();
          const ta = (s.aim.target * Math.PI) / 180, aa = (s.aim.a * Math.PI) / 180;
          ctx.fillStyle = '#3a8fe0'; ctx.beginPath(); ctx.arc(cx + Math.cos(ta) * 80, cy + Math.sin(ta) * 80, 10, 0, 7); ctx.fill();
          ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * 70, cy + Math.sin(aa) * 70); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '14px "Exo 2"'; ctx.fillText('Наведите отражатель на Землю 🌍', cx, H / 2 - 88);
        }
      }
    }

    lander();
  }

  Missions.register({
    id: 'landing', role: 'pilot', cat: 'moon', icon: '🌕', title: 'Высадка на поверхность',
    short: 'Посадка, сбор образцов, установка приборов и поиск водяного льда',
    facts: [
      'Экспедиции Apollo привезли на Землю 382 кг лунного грунта.',
      'Лазерные отражатели, установленные астронавтами Apollo, до сих пор используются: по ним измеряют расстояние до Луны с точностью до миллиметров.',
      'Сейсмометры показали, что на Луне бывают «лунотрясения».',
      'В постоянно затенённых кратерах у полюсов температура опускается ниже −230 °C — там сохраняется водяной лёд.',
    ],
    briefing: [
      'Пилот, это исторический момент: высадка на Луну! Сначала вам предстоит вручную посадить модуль на площадку у южного полюса.',
      'После посадки — выход на поверхность. Нужно <b>собрать образцы грунта</b> разных типов: для науки ценно разнообразие, а не количество.',
      'Затем <b>установить приборы</b>: сейсмометр — подальше от модуля и на ровном месте, а лазерный отражатель — точно направить на Землю.',
      'И главное — <b>поиск водяного льда</b> в тёмном кратере. Там холодно, заряд скафандра тратится быстрее. Ориентируйтесь на нейтронный счётчик: чем выше сигнал, тем больше водорода в грунте.',
    ],
    controls: '<b>Стрелки / WASD</b> — двигатель и поворот, затем ходьба. <b>E</b> — действие, <b>F</b> — бур.',
    start,
  });
})();
