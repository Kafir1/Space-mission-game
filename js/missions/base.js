'use strict';
/* Миссия 7. Строительство базы: план размещения модулей у южного полюса Луны */
(function () {
  const MAP = [
    'RRRpppppXXpppp',
    'RRRppppppppXpp',
    'RpppppCCCppppp',
    'ppppppCCCCpppp',
    'ppXXppCCCppppp',
    'ppXXpppppppppR',
    'ppppppppppppRR',
    'ppppXXppppppRR',
    'ppppppppppppRR',
  ];
  const TERR = {
    R: 'Освещённый гребень: Солнце почти не заходит, хороший обзор Земли',
    p: 'Равнина: ровный реголит, удобно строить',
    C: 'Постоянно затенённый кратер: водяной лёд, −230 °C, строить нельзя',
    X: 'Валуны и крутые склоны: строить нельзя',
  };
  const MODS = {
    hab: { icon: '🏠', name: 'Жилой модуль', cost: 30, power: -8, max: 1 },
    solar: { icon: '☀️', name: 'Солнечная панель', cost: 10, power: 10, max: 8 },
    pad: { icon: '🛬', name: 'Посадочная площадка', cost: 15, power: 0, max: 1 },
    isru: { icon: '⛏️', name: 'Установка ISRU', cost: 25, power: -12, max: 1 },
    ant: { icon: '📡', name: 'Антенна связи', cost: 10, power: -2, max: 1 },
    shelter: { icon: '🛡️', name: 'Радиационное укрытие', cost: 15, power: -1, max: 1 },
    green: { icon: '🌱', name: 'Оранжерея', cost: 20, power: -6, max: 1 },
    garage: { icon: '🚙', name: 'Гараж луноходов', cost: 10, power: -3, max: 1 },
  };
  const BUDGET = 170;
  const ROWS = MAP.length, COLS = MAP[0].length;

  function start(root, api) {
    const placed = {}; // "r,c" -> mod id
    let sel = 'hab';
    api.hint('Выберите модуль в палитре и нажмите на клетку карты. Нажатие на построенный модуль — снести. Справа — требования инженеров: постарайтесь выполнить все, уложившись в бюджет.');
    root.innerHTML = '';
    const el = h(`<div class="base-layout">
      <div>
        <div class="base-grid" style="grid-template-columns:repeat(${COLS},1fr)"></div>
        <p class="small muted terr-info">Наведите на клетку, чтобы узнать тип местности.</p>
        <div class="row small"><span><span style="display:inline-block;width:12px;height:12px;background:#a5a29a;border-radius:3px"></span> гребень</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#6f6c66;border-radius:3px"></span> равнина</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#1d2333;border-radius:3px"></span> кратер со льдом</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#4e4b46;border-radius:3px"></span> валуны</span></div>
      </div>
      <div>
        <div class="card" style="margin-top:0"><h4>Модули</h4><div class="palette">${Object.entries(MODS).map(([k, m]) => `<button class="pal-item" data-k="${k}"><span>${m.icon} ${m.name}</span><span class="small muted">${m.cost} млн $ · <span class="cnt" data-c="${k}">0</span>/${m.max}</span></button>`).join('')}</div></div>
        <div class="card"><h4>Ресурсы</h4><div class="kv small"><span>Бюджет</span><b class="bud"></b><span>Энергия</span><b class="pow"></b></div></div>
        <div class="card"><h4>Требования</h4><ul class="checklist"></ul></div>
        <div class="row"><button class="btn small clear">Очистить</button><button class="btn btn-primary submit">✔ Утвердить план</button></div>
      </div></div>`);
    root.appendChild(el);
    const grid = $('.base-grid', el);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = MAP[r][c];
      grid.appendChild(h(`<div class="cell t-${t}" data-rc="${r},${c}" title="${TERR[t]}"></div>`));
    }

    const cellsOf = (k) => Object.entries(placed).filter(([, v]) => v === k).map(([rc]) => rc.split(',').map(Number));
    const near = (a, b, d = 1) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= d;
    const terrain = ([r, c]) => MAP[r][c];
    function evaluate() {
      const hab = cellsOf('hab')[0];
      const solars = cellsOf('solar');
      let cost = 0, prod = 0, cons = 0;
      Object.entries(placed).forEach(([rc, k]) => {
        cost += MODS[k].cost;
        if (k === 'solar') prod += terrain(rc.split(',').map(Number)) === 'R' ? 10 : 3;
        else cons -= MODS[k].power;
      });
      const pad = cellsOf('pad')[0], isru = cellsOf('isru')[0], ant = cellsOf('ant')[0], sh = cellsOf('shelter')[0], gr = cellsOf('green')[0], ga = cellsOf('garage')[0];
      const adjCrater = (p) => { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = p[0] + dr, c = p[1] + dc; if (r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c] === 'C') return true; } return false; };
      const rules = [
        { t: 'Жилой модуль построен', ok: !!hab, w: 11 },
        { t: `Энергии хватает: ${prod} кВт ≥ ${cons} кВт`, ok: prod >= cons && cons > 0, w: 11 },
        { t: 'Все солнечные панели на освещённых гребнях', ok: solars.length > 0 && solars.every((p) => terrain(p) === 'R'), w: 11 },
        { t: 'Площадка не ближе 5 клеток к жилью (пыль от двигателей)', ok: !!(pad && hab && Math.hypot(pad[0] - hab[0], pad[1] - hab[1]) >= 5), w: 11 },
        { t: 'ISRU вплотную к кратеру со льдом', ok: !!(isru && adjCrater(isru)), w: 11 },
        { t: 'Антенна на гребне (прямая видимость Земли)', ok: !!(ant && terrain(ant) === 'R'), w: 11 },
        { t: 'Радиационное укрытие рядом с жилым модулем', ok: !!(sh && hab && near(sh, hab)), w: 11 },
        { t: `Бюджет: ${cost} из ${BUDGET} млн $`, ok: cost <= BUDGET && cost > 0, w: 11 },
        { t: 'Бонус: оранжерея рядом с жилым модулем', ok: !!(gr && hab && near(gr, hab)), w: 6, bonus: true },
        { t: 'Бонус: гараж рядом с площадкой или жильём', ok: !!(ga && ((pad && near(ga, pad)) || (hab && near(ga, hab)))), w: 6, bonus: true },
      ];
      return { rules, cost, prod, cons };
    }
    function render() {
      $$('.cell', grid).forEach((c) => { const k = placed[c.dataset.rc]; c.textContent = k ? MODS[k].icon : ''; c.classList.remove('badplace'); });
      Object.keys(MODS).forEach((k) => { $(`[data-c="${k}"]`, el).textContent = cellsOf(k).length; });
      $$('.pal-item', el).forEach((b) => b.classList.toggle('sel', b.dataset.k === sel));
      const ev = evaluate();
      $('.bud', el).innerHTML = `<span class="${ev.cost > BUDGET ? 'bad' : 'ok'}">${ev.cost} / ${BUDGET} млн $</span>`;
      $('.pow', el).innerHTML = `<span class="${ev.prod >= ev.cons ? 'ok' : 'bad'}">+${ev.prod} / −${ev.cons} кВт</span>`;
      $('.checklist', el).innerHTML = ev.rules.map((r) => `<li>${r.ok ? '✅' : r.bonus ? '➕' : '⬜'} ${r.t}</li>`).join('');
      cellsOf('solar').forEach((p) => { if (terrain(p) !== 'R') $(`[data-rc="${p[0]},${p[1]}"]`, grid).classList.add('badplace'); });
    }
    el.addEventListener('click', (e) => {
      const pi = e.target.closest('[data-k]');
      if (pi) { sel = pi.dataset.k; render(); return; }
      const cell = e.target.closest('[data-rc]');
      if (cell) {
        const rc = cell.dataset.rc;
        if (placed[rc]) { delete placed[rc]; render(); return; }
        const t = terrain(rc.split(',').map(Number));
        if (t === 'C' || t === 'X') { toast(t === 'C' ? 'В затенённом кратере строить нельзя: −230 °C и полная темнота.' : 'Здесь валуны и крутой склон — строить нельзя.'); return; }
        if (cellsOf(sel).length >= MODS[sel].max) { toast(`Лимит: ${MODS[sel].name} — не больше ${MODS[sel].max}.`); return; }
        placed[rc] = sel; render();
      }
    });
    $('.terr-info', el);
    grid.addEventListener('mouseover', (e) => { const c = e.target.closest('[data-rc]'); if (c) $('.terr-info', el).textContent = TERR[terrain(c.dataset.rc.split(',').map(Number))]; });
    $('.clear', el).addEventListener('click', () => { Object.keys(placed).forEach((k) => delete placed[k]); render(); });
    $('.submit', el).addEventListener('click', () => {
      const ev = evaluate();
      const score = ev.rules.reduce((s, r) => s + (r.ok ? r.w : 0), 0);
      const details = ev.rules.map((r) => `${r.ok ? '✅' : r.bonus ? '➖' : '❌'} ${r.t}`);
      details.push(`Остаток бюджета: ${BUDGET - ev.cost} млн $`);
      api.finish(score, details);
    });
    let toastEl = null;
    function toast(m) { if (toastEl) toastEl.remove(); toastEl = h(`<div class="toast">${m}</div>`); document.body.appendChild(toastEl); const t = toastEl; api.scope.timeout(() => t.remove(), 2200); api.scope.fns.push(() => t.remove()); }
    render();
  }

  Missions.register({
    id: 'base', role: 'pilot', cat: 'moon', icon: '🏗️', title: 'Строительство базы',
    short: 'Разработать план лунной базы у южного полюса',
    facts: [
      'Глава NASA Айзекман говорит, что цель — построить базу и обеспечить постоянное присутствие ради научной ценности и как полигон для навыков, необходимых для отправки людей на Марс.',
      'На гребнях у южного полюса Солнце светит большую часть года — идеальное место для солнечных батарей.',
      'Двигатели посадочных кораблей разгоняют пыль и камни до огромных скоростей, поэтому площадки строят подальше от жилья.',
      'Лунный реголит защищает от радиации: укрытия можно засыпать грунтом.',
    ],
    briefing: [
      'Пилот, совет директоров одобрил строительство постоянной лунной базы. Вам, как человеку, который будет там жить, поручено разработать план.',
      'Перед вами карта района у южного полюса: светлые гребни освещены почти круглый год, в тёмном кратере — водяной лёд, а среди валунов строить нельзя.',
      'Инженеры передали требования: солнечные панели — на свету, антенна — на возвышенности, ISRU — у льда, посадочная площадка — подальше от жилья, укрытие — рядом. И, конечно, нельзя выйти за бюджет.',
    ],
    controls: 'Мышь или палец: выбор модуля в палитре и клетки на карте.',
    start,
  });
})();
