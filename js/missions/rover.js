'use strict';
/* Миссия 10. Марсоход: вид с камеры, поиск необычных материалов и фотосъёмка местности */
(function () {
  const W = 960, H = 540, HZ = 240, FOV = (70 * Math.PI) / 180, FP = (W / 2) / Math.tan(FOV / 2), CAM_H = 2;
  const WORLD = 260;
  const TYPES = {
    basalt: { name: 'Базальт', col: '#5b4538', rare: false, info: 'Si, Mg, Fe — обычная вулканическая порода. Ничего особенного.' },
    sand: { name: 'Песчаник', col: '#a5643f', rare: false, info: 'Si, оксиды железа — обычный осадочный материал.' },
    hematite: { name: 'Гематитовые сферулы', col: '#6c5a63', rare: true, info: 'Гематит Fe₂O₃ — образуется в воде! Признак древних водоёмов.' },
    gypsum: { name: 'Гипсовые жилы', col: '#9a6a4c', rare: true, info: 'Гипс CaSO₄·2H₂O — жилы, оставленные подземной водой.' },
    meteorite: { name: 'Метеорит', col: '#3a3a40', rare: true, info: 'Fe ≈ 90%, Ni ≈ 8% — железо-никелевый метеорит!' },
    olivine: { name: 'Оливин', col: '#6f7a45', rare: true, info: 'Оливин (Mg,Fe)₂SiO₄ — вещество из глубин планеты.' },
    mudstone: { name: 'Слоистый аргиллит', col: '#8a5b45', rare: true, info: 'Отложения древнего озера. Может хранить органику — главный кандидат для поиска жизни!' },
    silica: { name: 'Опаловый кремнезём', col: '#d8cfc0', rare: true, info: 'SiO₂ — след горячих источников. Перспективно для поиска следов жизни.' },
    sulfur: { name: 'Кристаллы серы', col: '#c9b24a', rare: true, info: 'Чистая сера S — редчайшая находка на Марсе.' },
  };
  const MARKS = {
    dune: { name: 'Песчаная дюна', w: 14, h: 3, r: 6 },
    cliff: { name: 'Слоистый утёс', w: 26, h: 8, r: 11 },
    crater: { name: 'Ударный кратер', w: 16, h: 1.2, r: 7 },
    devil: { name: 'Пылевой вихрь', w: 4, h: 30, r: 0 },
  };

  function start(root, api) {
    const S = api.scope;
    const keys = S.trackKeys();
    const r = rng(Math.floor(Math.random() * 1e9));
    root.innerHTML = '';
    const el = h(`<div><div class="canvas-wrap"><canvas class="game-canvas" width="${W}" height="${H}"></canvas></div>
      <div class="row center" style="margin-top:8px"><button class="btn small end">⏹ Завершить сеанс</button></div></div>`);
    root.appendChild(el);
    el.insertBefore(touchControls(S, [
      [{ label: '◀', code: 'ArrowLeft' }, { label: '▲', code: 'ArrowUp' }, { label: '▼', code: 'ArrowDown' }, { label: '▶', code: 'ArrowRight' }],
      [{ label: '🔬', code: 'Space' }, { label: '🧪', code: 'KeyE' }, { label: '📸', code: 'KeyF' }],
    ]), el.lastElementChild);
    const cv = $('canvas', el), ctx = cv.getContext('2d');
    api.hint('W/S — ехать, A/D — поворот. Наведите перекрестие на камень: Пробел — лазерный анализ (до 12 м), E — взять образец бурением (подъехать вплотную, до 3,5 м). F — фотоснимок. Ищите необычные породы и снимите все ориентиры на мини-карте.');

    // мир
    const objs = [];
    const free = (x, y, d) => objs.every((o) => dist(o.x, o.y, x, y) > d + (o.rad || 0)) && dist(x, y, WORLD / 2, WORLD / 2) > 10;
    const place = (o, d) => { let tries = 0; do { o.x = r.range(15, WORLD - 15); o.y = r.range(15, WORLD - 15); tries++; } while (!free(o.x, o.y, d) && tries < 200); objs.push(o); return o; };
    ['dune', 'cliff', 'crater'].forEach((k) => place({ kind: 'mark', m: k, rad: MARKS[k].r, shot: false }, 25));
    const devil = { kind: 'mark', m: 'devil', rad: 0, shot: false, x: r.range(40, 220), y: r.range(40, 220), vx: r.range(-1.5, 1.5), vy: r.range(-1.5, 1.5) };
    objs.push(devil);
    const rare = shuffle(['hematite', 'gypsum', 'meteorite', 'olivine', 'mudstone', 'silica', 'sulfur'], r);
    rare.forEach((t) => place({ kind: 'rock', t, size: r.range(0.45, 0.75), seed: r() * 1000, rad: 0.9 }, 12));
    for (let i = 0; i < 70; i++) place({ kind: 'rock', t: r() < 0.5 ? 'basalt' : 'sand', size: r.range(0.2, 0.8), seed: r() * 1000, rad: 0.8 }, 2);
    const pebbles = Array.from({ length: 900 }, () => ({ x: r() * WORLD, y: r() * WORLD, s: r.range(0.04, 0.12), c: r() < 0.5 ? '#6a3f2a' : '#a8714c' }));

    const s = { x: WORLD / 2, y: WORLD / 2, a: 0, v: 0, energy: 100, tubes: 5, samples: [], wasted: 0, photos: 0, analyzed: 0, t: 0, msg: '', msgT: 0, flash: 0, over: false, scan: null, scanT: 0 };
    const say = (m, t = 3.5) => { s.msg = m; s.msgT = t; };

    const proj = (o) => {
      const dx = o.x - s.x, dy = o.y - s.y;
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      const z = dx * ca + dy * sa, lat = -dx * sa + dy * ca;
      return { z, lat, sx: W / 2 + (lat / z) * FP, gy: HZ + (CAM_H * FP) / z };
    };
    const inSight = () => {
      let best = null;
      objs.forEach((o) => {
        if (o.kind !== 'rock' || o.taken) return;
        const p = proj(o);
        if (p.z < 0.6 || p.z > 14) return;
        const ang = Math.abs(Math.atan2(p.lat, p.z));
        if (ang < 0.07 + o.size / p.z * 0.5 && (!best || p.z < best.p.z)) best = { o, p };
      });
      return best;
    };

    S.on(window, 'keydown', (e) => {
      if (s.over) return;
      if (e.code === 'Space' || e.code === 'KeyL') {
        const t = inSight();
        if (!t) { say('В перекрестии нет камня ближе 12–14 м.'); return; }
        if (t.p.z > 12) { say('Слишком далеко для лазера ChemCam (макс. 12 м).'); return; }
        s.energy -= 1.5; s.analyzed++;
        t.o.known = true;
        s.scan = t.o; s.scanT = 5; s.flash = 0.15;
        return;
      }
      if (e.code === 'KeyE' || e.code === 'KeyK') {
        const t = inSight();
        if (!t || t.p.z > 3.5) { say('Подъедьте к камню вплотную (до 3,5 м) и наведите перекрестие.'); return; }
        if (s.tubes <= 0) { say('Пробирки для образцов закончились.'); return; }
        s.tubes--; s.energy -= 5; t.o.taken = true;
        const T = TYPES[t.o.t];
        if (T.rare) { s.samples.push(t.o.t); say(`✅ Образец «${T.name}» запечатан в пробирку! Осталось пробирок: ${s.tubes}.`, 4.5); }
        else { s.wasted++; say(`Образец «${T.name}» — обычная порода, пробирка потрачена зря. Осталось: ${s.tubes}.`, 4.5); }
        return;
      }
      if (e.code === 'KeyF') {
        s.flash = 0.25; s.energy -= 0.5;
        const m = objs.filter((o) => o.kind === 'mark').map((o) => ({ o, p: proj(o) }))
          .filter(({ p, o }) => p.z > 2 && p.z < 80 && Math.abs(Math.atan2(p.lat, p.z)) < 0.22 && !o.shot);
        if (m.length) { m[0].o.shot = true; say(`📸 Снимок: ${MARKS[m[0].o.m].name} — отличный кадр для геологов!`); }
        else { s.photos++; say(s.photos <= 3 ? '📸 Панорамный снимок местности сохранён.' : '📸 Снимок сохранён (панорам уже достаточно).'); }
      }
      if (e.code === 'KeyQ') end();
    });
    $('.end', el).addEventListener('click', () => end());

    function end() {
      if (s.over) return; s.over = true;
      const marksShot = objs.filter((o) => o.kind === 'mark' && o.shot).length;
      const uniq = new Set(s.samples).size;
      const score = uniq * 12 + marksShot * 7 + Math.min(3, s.photos) * 2 + clamp(s.energy, 0, 100) * 0.06 - s.wasted * 4;
      const d = [
        `Необычные образцы: <b>${uniq}</b> (${s.samples.map((t) => TYPES[t].name).join(', ') || '—'})`,
        `Пробирок потрачено на обычные породы: ${s.wasted}`,
        `Сфотографировано ориентиров: <b>${marksShot}/4</b>, панорамных снимков: ${s.photos}`,
        `Лазерных анализов: ${s.analyzed} · остаток энергии: ${Math.round(Math.max(0, s.energy))}%`,
      ];
      S.timeout(() => api.finish(score, d), 600);
    }

    S.raf((dt) => {
      if (s.over) return false;
      s.t += dt; s.msgT -= dt; s.flash -= dt; s.scanT -= dt;
      let acc = 0;
      if (keys.ArrowUp || keys.KeyW) acc = 1; if (keys.ArrowDown || keys.KeyS) acc = -0.6;
      s.v = lerp(s.v, acc * 4, dt * 2);
      let turn = 0;
      if (keys.ArrowLeft || keys.KeyA) turn = -1; if (keys.ArrowRight || keys.KeyD) turn = 1;
      s.a += turn * 0.9 * dt;
      const nx = s.x + Math.cos(s.a) * s.v * dt, ny = s.y + Math.sin(s.a) * s.v * dt;
      const block = objs.find((o) => !o.taken && o.rad && dist(nx, ny, o.x, o.y) < o.rad + (o.kind === 'rock' ? 0.4 : 1.2));
      if (block || nx < 3 || ny < 3 || nx > WORLD - 3 || ny > WORLD - 3) { s.v = 0; if (block && block.kind === 'mark' && s.msgT <= 0) say('Слишком крутой склон — объезжайте.'); }
      else { s.x = nx; s.y = ny; }
      s.energy -= dt * (0.03 + Math.abs(s.v) * 0.06 + Math.abs(turn) * 0.05);
      devil.x += devil.vx * dt; devil.y += devil.vy * dt;
      if (devil.x < 10 || devil.x > WORLD - 10) devil.vx *= -1; if (devil.y < 10 || devil.y > WORLD - 10) devil.vy *= -1;
      if (s.energy <= 0) { s.energy = 0; say('Батарея разряжена — марсоход уходит в спящий режим.'); end(); }
      if (s.t > 360) { say('Окно связи закрывается.'); end(); }
      draw();
    });

    function drawRock(o, p) {
      const sz = (o.size * FP) / p.z, x = p.sx, y = p.gy;
      if (sz < 1.2) { ctx.fillStyle = TYPES[o.t].col; ctx.fillRect(x, y - 1, 2, 1); return; }
      const rr = rng(Math.floor(o.seed * 1000));
      const n = 9, pts = [];
      for (let i = 0; i <= n; i++) { const th = Math.PI + (i / n) * Math.PI; const k = 0.75 + rr() * 0.35; pts.push([x + Math.cos(th) * sz * k, y + Math.sin(th) * sz * 0.65 * k]); }
      const T = TYPES[o.t];
      ctx.fillStyle = 'rgba(40,15,5,.35)'; ctx.beginPath(); ctx.ellipse(x - sz * 0.3, y, sz * 1.2, sz * 0.18, 0, 0, 7); ctx.fill();
      const g = ctx.createLinearGradient(x - sz, 0, x + sz, 0);
      g.addColorStop(0, shade(T.col, -35)); g.addColorStop(0.6, T.col); g.addColorStop(1, shade(T.col, 30));
      if (o.t === 'meteorite') { g.addColorStop(0.8, '#8a8a95'); }
      ctx.fillStyle = g; ctx.beginPath(); pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip();
      if (o.t === 'gypsum') { ctx.strokeStyle = '#f4efe6'; ctx.lineWidth = Math.max(1, sz * 0.05); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - sz, y - sz * (0.1 + i * 0.18)); ctx.lineTo(x + sz, y - sz * (0.25 + i * 0.12)); ctx.stroke(); } }
      if (o.t === 'mudstone') { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,220,180,.25)' : 'rgba(60,25,10,.25)'; ctx.fillRect(x - sz, y - sz * 0.7 + i * sz * 0.11, sz * 2, sz * 0.06); } }
      if (o.t === 'silica') { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - sz, y - sz * 0.7, sz * 2, sz * 0.25); }
      if (o.t === 'olivine') { ctx.fillStyle = 'rgba(140,200,90,.35)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + (rr() - 0.5) * sz * 1.4, y - rr() * sz * 0.5, sz * 0.08, 0, 7); ctx.fill(); } }
      if (o.t === 'sulfur') { ctx.fillStyle = '#ffe85a'; for (let i = 0; i < 7; i++) { const cx = x + (rr() - 0.5) * sz * 1.4, cy = y - rr() * sz * 0.5; ctx.beginPath(); ctx.moveTo(cx, cy - sz * 0.12); ctx.lineTo(cx + sz * 0.06, cy); ctx.lineTo(cx - sz * 0.06, cy); ctx.fill(); } }
      if (o.t === 'meteorite') { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x + sz * 0.3, y - sz * 0.45, sz * 0.2, sz * 0.08, -0.4, 0, 7); ctx.fill(); }
      ctx.restore();
      if (o.t === 'hematite') { ctx.fillStyle = '#3b3f52'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(x + (rr() - 0.5) * sz * 2.6, y + rr() * sz * 0.12, Math.max(0.8, sz * 0.07), 0, 7); ctx.fill(); } }
      if (o.known) { ctx.fillStyle = T.rare ? '#7cf0d0' : '#ccc'; ctx.font = '12px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText(T.rare ? `★ ${T.name}` : T.name, x, y - sz * 0.8 - 6); }
    }
    function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = (v) => clamp(v + d, 0, 255); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }

    function drawMark(o, p) {
      const M = MARKS[o.m], x = p.sx, y = p.gy, k = FP / p.z;
      const w = M.w * k, hh = M.h * k;
      if (o.m === 'dune') {
        const g = ctx.createLinearGradient(0, y - hh, 0, y); g.addColorStop(0, '#d79a5e'); g.addColorStop(1, '#b27445');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w * 0.1, y - hh * 2, x + w / 2, y); ctx.fill();
        ctx.strokeStyle = 'rgba(120,70,40,.4)'; ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + (w * i) / 10, y - hh * 0.15 * i); ctx.quadraticCurveTo(x, y - hh * (0.25 + i * 0.25), x + w / 2 - (w * i) / 10, y - hh * 0.15 * i); ctx.stroke(); }
      } else if (o.m === 'cliff') {
        ctx.fillStyle = '#8f5638'; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.38, y - hh); ctx.lineTo(x + w * 0.4, y - hh * 0.92); ctx.lineTo(x + w / 2, y); ctx.fill();
        for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? 'rgba(230,180,130,.35)' : 'rgba(80,35,20,.3)'; const yy = y - hh + (i * hh) / 9; ctx.fillRect(x - w * 0.42, yy, w * 0.84, hh / 18); }
      } else if (o.m === 'crater') {
        ctx.fillStyle = '#6b3b25'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(2, (w / 2) * (CAM_H / p.z) * 1.4), 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#b77b52'; ctx.beginPath(); ctx.ellipse(x, y - hh * 0.6, w / 2 + 2, hh, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#4e2a1a'; ctx.beginPath(); ctx.ellipse(x, y - hh * 0.3, w * 0.38, hh * 0.55, 0, Math.PI, 0); ctx.fill();
      } else if (o.m === 'devil') {
        const g = ctx.createLinearGradient(x, y - hh, x, y); g.addColorStop(0, 'rgba(210,150,100,0)'); g.addColorStop(1, 'rgba(210,150,100,.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.15, y); ctx.lineTo(x - w * (1.2 + 0.2 * Math.sin(s.t * 3)), y - hh); ctx.lineTo(x + w * (1.2 + 0.2 * Math.cos(s.t * 3)), y - hh); ctx.lineTo(x + w * 0.15, y); ctx.fill();
      }
      if (!o.shot && p.z < 90) { ctx.fillStyle = '#ffd25a'; ctx.font = '12px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText(`📍 ${M.name}`, x, y - (o.m === 'devil' ? hh * 0.5 : hh * 1.4) - 10); }
    }

    function draw() {
      // небо
      const sg = ctx.createLinearGradient(0, 0, 0, HZ); sg.addColorStop(0, '#c9915e'); sg.addColorStop(1, '#ecc79c');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, HZ + 2);
      // солнце
      const sunAz = 0.8; let da = ((sunAz - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(da) < FOV / 2 + 0.1) { const sx = W / 2 + Math.tan(da) * FP; const g = ctx.createRadialGradient(sx, 70, 2, sx, 70, 60); g.addColorStop(0, 'rgba(230,240,255,.95)'); g.addColorStop(0.15, 'rgba(180,200,240,.6)'); g.addColorStop(1, 'rgba(180,200,240,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, 70, 60, 0, 7); ctx.fill(); }
      // горы
      const ridge = (amp, base, col, f) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, HZ + 1);
        for (let x = 0; x <= W; x += 6) { const az = s.a + Math.atan((x - W / 2) / FP); const hgt = base + amp * (0.5 + 0.3 * Math.sin(az * 3 * f + 1) + 0.2 * Math.sin(az * 7 * f + 2) + 0.1 * Math.sin(az * 17 + f)); ctx.lineTo(x, HZ - hgt); }
        ctx.lineTo(W, HZ + 1); ctx.fill();
      };
      ridge(40, 6, '#c89a74', 1); ridge(22, 2, '#a8704c', 2);
      // грунт
      const gg = ctx.createLinearGradient(0, HZ, 0, H); gg.addColorStop(0, '#b67a4f'); gg.addColorStop(1, '#8a4f30');
      ctx.fillStyle = gg; ctx.fillRect(0, HZ, W, H - HZ);
      pebbles.forEach((pb) => {
        if (Math.abs(pb.x - s.x) > 40 || Math.abs(pb.y - s.y) > 40) return;
        const p = proj(pb); if (p.z < 0.8 || p.z > 40 || Math.abs(p.sx - W / 2) > W / 2 + 10) return;
        const sz = (pb.s * FP) / p.z; ctx.fillStyle = pb.c; ctx.fillRect(p.sx, p.gy - sz * 0.3, sz, sz * 0.5);
      });
      // объекты (дальние первыми)
      const vis = [];
      objs.forEach((o) => { if (o.taken) return; const p = proj(o); if (p.z < 0.7 || p.z > 140) return; const half = (o.kind === 'mark' ? MARKS[o.m].w : 1) * FP / p.z; if (p.sx < -half || p.sx > W + half) return; vis.push({ o, p }); });
      vis.sort((a, b) => b.p.z - a.p.z);
      vis.forEach(({ o, p }) => (o.kind === 'rock' ? drawRock(o, p) : drawMark(o, p)));
      // дымка
      const hz = ctx.createLinearGradient(0, HZ - 30, 0, HZ + 40); hz.addColorStop(0, 'rgba(236,199,156,0)'); hz.addColorStop(0.5, 'rgba(236,199,156,.35)'); hz.addColorStop(1, 'rgba(236,199,156,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, HZ - 30, W, 70);
      // корпус марсохода
      ctx.fillStyle = '#d8d4cc'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(120, H - 46); ctx.lineTo(W - 120, H - 46); ctx.lineTo(W, H); ctx.fill();
      ctx.fillStyle = '#9c978e'; ctx.fillRect(140, H - 46, W - 280, 6);
      ctx.fillStyle = '#2b2b2e'; ctx.beginPath(); ctx.ellipse(70, H - 8, 60, 30, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.ellipse(W - 70, H - 8, 60, 30, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#8c8880'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(W - 230, H - 40); ctx.lineTo(W - 190, H - 110); ctx.lineTo(W - 150, H - 96); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.fillRect(W - 160, H - 110, 26, 22);
      // перекрестие
      const t = inSight();
      ctx.strokeStyle = t ? '#7cf0d0' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(W / 2, HZ + 60, 22, 0, 7); ctx.moveTo(W / 2 - 34, HZ + 60); ctx.lineTo(W / 2 - 12, HZ + 60); ctx.moveTo(W / 2 + 12, HZ + 60); ctx.lineTo(W / 2 + 34, HZ + 60); ctx.stroke();
      // для прицеливания используется линия взгляда: покажем точку на камне
      if (t) { ctx.fillStyle = '#7cf0d0'; ctx.font = '13px "Exo 2"'; ctx.textAlign = 'center'; ctx.fillText(`Цель: ${fmt(t.p.z, 1)} м ${t.p.z <= 3.5 ? '· E — взять образец' : t.p.z <= 12 ? '· Пробел — лазер' : ''}`, W / 2, HZ + 100); ctx.strokeStyle = 'rgba(124,240,208,.6)'; ctx.beginPath(); ctx.arc(t.p.sx, t.p.gy - (t.o.size * FP / t.p.z) * 0.3, 8, 0, 7); ctx.stroke(); }
      // HUD
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 10, 300, 96);
      ctx.textAlign = 'left'; ctx.font = '13px "Exo 2"';
      ctx.fillStyle = '#ff6b6b'; ctx.fillText(`● NAVCAM · Sol 1${String(400 + Math.floor(s.t / 60)).padStart(3, '0')} · ${fmt(360 - s.t, 0)} c до конца связи`, 20, 28);
      ctx.fillStyle = '#222'; ctx.fillRect(20, 38, 160, 12); ctx.fillStyle = s.energy < 20 ? '#ff5d6c' : '#4fe08a'; ctx.fillRect(20, 38, s.energy * 1.6, 12);
      ctx.fillStyle = '#fff'; ctx.fillText(`Энергия ${Math.round(s.energy)}%`, 190, 49);
      ctx.fillText(`Пробирки: ${'🧪'.repeat(s.tubes)}${'▫'.repeat(5 - s.tubes)}  · образцов ${new Set(s.samples).size}`, 20, 70);
      ctx.fillText(`Ориентиры: ${objs.filter((o) => o.kind === 'mark' && o.shot).length}/4 · скорость ${fmt(Math.abs(s.v), 1)} м/с`, 20, 92);
      // компас
      const deg = ((((s.a * 180) / Math.PI) % 360) + 360 + 90) % 360;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - 60, 10, 120, 24); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`Курс ${fmt(deg, 0)}°`, W / 2, 27);
      // мини-карта
      const ms = 150, mx = W - ms - 10, my = 10, k = ms / WORLD;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(mx, my, ms, ms);
      objs.forEach((o) => {
        if (o.taken) return;
        if (o.kind === 'rock') { if (dist(o.x, o.y, s.x, s.y) > 60) return; ctx.fillStyle = o.known ? (TYPES[o.t].rare ? '#7cf0d0' : '#888') : '#d9a37a'; ctx.fillRect(mx + o.x * k - 1, my + o.y * k - 1, 2, 2); }
        else { ctx.fillStyle = o.shot ? '#4fe08a' : '#ffd25a'; ctx.beginPath(); ctx.arc(mx + o.x * k, my + o.y * k, 4, 0, 7); ctx.fill(); }
      });
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx + s.x * k, my + s.y * k); ctx.lineTo(mx + (s.x + Math.cos(s.a) * 12) * k, my + (s.y + Math.sin(s.a) * 12) * k); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + s.x * k, my + s.y * k, 3, 0, 7); ctx.fill();
      // окно анализа
      if (s.scan && s.scanT > 0) {
        const T = TYPES[s.scan.t];
        ctx.fillStyle = 'rgba(0,10,25,.85)'; ctx.fillRect(20, H - 160, 420, 96);
        ctx.fillStyle = T.rare ? '#7cf0d0' : '#ccc'; ctx.font = 'bold 15px "Exo 2"'; ctx.textAlign = 'left';
        ctx.fillText(`🔬 ChemCam: ${T.name}${T.rare ? ' — НЕОБЫЧНО!' : ''}`, 32, H - 134);
        ctx.fillStyle = '#fff'; ctx.font = '13px "Exo 2"';
        wrap(T.info, 32, H - 112, 396, 18);
        // спектр
        const sr = rng(s.scan.t.length * 97);
        ctx.strokeStyle = T.rare ? '#7cf0d0' : '#999'; ctx.beginPath();
        for (let i = 0; i < 380; i += 4) { const y = H - 70 - (sr() < 0.08 ? sr() * 22 : sr() * 4); i ? ctx.lineTo(32 + i, y) : ctx.moveTo(32 + i, y); }
        ctx.stroke();
      }
      if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${s.flash * 2})`; ctx.fillRect(0, 0, W, H); }
      if (s.msgT > 0) { ctx.fillStyle = 'rgba(0,10,25,.85)'; ctx.fillRect(W / 2 - 330, 46, 660, 30); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '14px "Exo 2"'; ctx.fillText(s.msg, W / 2, 66); }
    }
    function wrap(text, x, y, mw, lh) {
      const words = text.split(' '); let line = '';
      words.forEach((w) => { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > mw) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; });
      ctx.fillText(line, x, y);
    }
  }

  Missions.register({
    id: 'rover', role: 'scientist', cat: 'mars', icon: '🤖', title: 'Посадочные модули и марсоходы',
    short: 'Вид с камеры марсохода: поиск необычных материалов и съёмка местности',
    facts: [
      'Марсоходы Curiosity, Perseverance и китайский Zhurong ищут следы древней жизни, изучают геологию и историю воды на Марсе.',
      'Perseverance собирает образцы в герметичные пробирки для будущей доставки на Землю.',
      'Лазер ChemCam «испаряет» крошечную точку на камне и по спектру вспышки определяет химический состав с расстояния до 7 метров (у нас — до 12).',
      'Сигнал от Марса до Земли идёт от 3 до 22 минут, поэтому марсоходами управляют командами на целый день вперёд.',
    ],
    briefing: [
      'Учёный, вы на связи с марсоходом. Перед вами — изображение с его навигационной камеры.',
      'Ваша задача — найти <b>необычные материалы</b>: следы воды, метеориты, редкие минералы. Обычные базальт и песчаник нам не нужны. Чтобы понять, что перед вами, используйте лазерный анализ.',
      'Пробирок всего пять, поэтому не тратьте их на обычные камни. Ещё нужно <b>сфотографировать местность</b>: ориентиры отмечены на мини-карте жёлтым.',
      'Следите за энергией: езда и бурение разряжают батарею. Сеанс связи — 6 минут.',
    ],
    controls: '<b>W/S/↑↓</b> — движение, <b>A/D/←→</b> — поворот, <b>Пробел</b> — лазер, <b>E</b> — взять образец, <b>F</b> — фото, <b>Q</b> — завершить.',
    start,
  });
})();
