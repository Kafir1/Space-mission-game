'use strict';
/* Миссия 8. Использование местных ресурсов: кислород, вода и топливо из реголита и льда */
(function () {
  const CYCLES = 8;
  const GOALS = { water: 300, o2: 400, fuel: 250 };
  const MACH = [
    { id: 'drill', name: '🧊 Бур для льда', desc: '6 кг льда / кВт', max: 20 },
    { id: 'exc', name: '🚜 Экскаватор реголита', desc: '0,2 т реголита / кВт', max: 30 },
    { id: 'melt', name: '🔥 Плавильня льда', desc: '8 кг воды / кВт (из льда)', max: 40 },
    { id: 'react', name: '⚗️ Реактор восстановления', desc: '0,1 т реголита → 2 кг воды / кВт', max: 30 },
    { id: 'elec', name: '⚡ Электролизёр', desc: '4 кг воды → 3,56 кг O₂ + 0,44 кг H₂ / кВт', max: 60 },
    { id: 'liq', name: '❄️ Сжижитель топлива', desc: '4 кг топлива (O₂:H₂ = 6:1) / кВт', max: 30 },
  ];
  const powerFor = (c) => (c === 5 || c === 6 ? 40 : 100);

  function start(root, api) {
    const st = { cycle: 1, ice: 0, reg: 0, water: 0, o2: 0, h2: 0, fuel: 0, log: [] };
    const alloc = { drill: 20, exc: 0, melt: 15, react: 0, elec: 0, liq: 0 };
    root.innerHTML = '';
    api.hint('Каждая смена — это распределение энергии между установками. Продукты одной установки сразу идут в следующую: бур → плавильня → электролизёр → сжижитель. Учтите: в сменах 5–6 наступает лунная ночь и энергии всего 40 кВт.');
    const el = h(`<div>
      <div class="stage-title"><h3>Завод ISRU · смена <b class="cyc">1</b>/${CYCLES}</h3><span class="muted small">Энергия в эту смену: <b class="pw"></b></span></div>
      <div class="card"><h4>Цели к концу ${CYCLES}-й смены</h4><div class="stock goals"></div></div>
      <div class="card"><h4>Склад</h4><div class="stock store"></div></div>
      <div class="card"><h4>Распределение энергии</h4><div class="machines">${MACH.map((m) => `
        <div class="isru-machine"><div><b>${m.name}</b><div class="small muted">${m.desc}</div></div>
        <input type="range" min="0" max="${m.max}" step="1" value="${alloc[m.id]}" data-m="${m.id}"><span><b class="v" data-v="${m.id}">${alloc[m.id]}</b> кВт</span></div>`).join('')}</div>
        <p class="small forecast"></p>
        <div class="row center"><button class="btn btn-primary run">▶ Запустить смену</button></div></div>
      <div class="card"><h4>Журнал</h4><ul class="report log small"></ul></div></div>`);
    root.appendChild(el);

    function simulate(a, s, apply) {
      const r = { ...s };
      const notes = [];
      r.ice += a.drill * 6;
      r.reg += a.exc * 0.2;
      const meltW = Math.min(a.melt * 8, r.ice); if (a.melt * 8 > r.ice + 0.01 && a.melt) notes.push('плавильне не хватило льда');
      r.ice -= meltW; r.water += meltW;
      const regUse = Math.min(a.react * 0.1, r.reg); if (a.react * 0.1 > r.reg + 1e-6 && a.react) notes.push('реактору не хватило реголита');
      r.reg -= regUse; r.water += regUse * 20;
      const wUse = Math.min(a.elec * 4, r.water); if (a.elec * 4 > r.water + 0.01 && a.elec) notes.push('электролизёру не хватило воды');
      r.water -= wUse; r.o2 += (wUse * 8) / 9; r.h2 += wUse / 9;
      const fuelMax = Math.min(a.liq * 4, r.o2 / (6 / 7), r.h2 / (1 / 7));
      if (a.liq * 4 > fuelMax + 0.01 && a.liq) notes.push('сжижителю не хватило O₂ или H₂');
      r.fuel += fuelMax; r.o2 -= (fuelMax * 6) / 7; r.h2 -= fuelMax / 7;
      return { r, notes };
    }
    const used = () => Object.values(alloc).reduce((a, b) => a + b, 0);
    function render() {
      const P = powerFor(st.cycle);
      $('.cyc', el).textContent = st.cycle;
      const u = used();
      $('.pw', el).innerHTML = `<span class="${u > P ? 'bad' : 'ok'}">${u} / ${P} кВт</span>${P < 100 ? ' 🌑 лунная ночь' : ' ☀️ день'}`;
      const bar = (v, g) => `<div class="meter" style="margin-top:4px"><i style="width:${clamp((v / g) * 100, 0, 100)}%;background:${v >= g ? '#4fe08a' : '#4ea3ff'}"></i></div>`;
      $('.goals', el).innerHTML = `
        <div>💧 Вода<b>${fmt(st.water, 0)} / ${GOALS.water} кг</b>${bar(st.water, GOALS.water)}</div>
        <div>🫁 Кислород<b>${fmt(st.o2, 0)} / ${GOALS.o2} кг</b>${bar(st.o2, GOALS.o2)}</div>
        <div>🚀 Топливо<b>${fmt(st.fuel, 0)} / ${GOALS.fuel} кг</b>${bar(st.fuel, GOALS.fuel)}</div>`;
      $('.store', el).innerHTML = `<div>🧊 Лёд<b>${fmt(st.ice, 0)} кг</b></div><div>🪨 Реголит<b>${fmt(st.reg, 1)} т</b></div><div>🎈 Водород H₂<b>${fmt(st.h2, 1)} кг</b></div>`;
      const { r, notes } = simulate(alloc, st);
      $('.forecast', el).innerHTML = `Прогноз после смены: вода ${fmt(r.water, 0)} кг, O₂ ${fmt(r.o2, 0)} кг, топливо ${fmt(r.fuel, 0)} кг.${notes.length ? ` <span class="warn">⚠ ${notes.join('; ')}</span>` : ''}`;
      $('.run', el).disabled = u > P;
    }
    el.addEventListener('input', (e) => {
      const m = e.target.dataset.m; if (!m) return;
      alloc[m] = +e.target.value; $(`[data-v="${m}"]`, el).textContent = alloc[m]; render();
    });
    $('.run', el).addEventListener('click', () => {
      if (used() > powerFor(st.cycle)) return;
      const { r, notes } = simulate(alloc, st);
      Object.assign(st, r);
      st.log.unshift(`Смена ${st.cycle}: вода ${fmt(st.water, 0)} кг, O₂ ${fmt(st.o2, 0)} кг, топливо ${fmt(st.fuel, 0)} кг${notes.length ? ` — ${notes.join('; ')}` : ''}`);
      $('.log', el).innerHTML = st.log.map((l) => `<li>${l}</li>`).join('');
      if (st.cycle === 4) api.hint('Внимание: следующие две смены — лунная ночь, всего 40 кВт от аккумуляторов. Заранее запаситесь льдом и водой, а ночью перерабатывайте запасы.');
      if (st.cycle === 6) api.hint('Солнце снова встало! Энергия — 100 кВт. Осталось две смены, проверьте, каких продуктов не хватает.');
      if (st.cycle >= CYCLES) return finish();
      st.cycle++;
      // при наступлении ночи урежем распределение пропорционально
      const P = powerFor(st.cycle), u = used();
      if (u > P) { const k = P / u; Object.keys(alloc).forEach((m) => { alloc[m] = Math.floor(alloc[m] * k); $(`[data-m="${m}"]`, el).value = alloc[m]; $(`[data-v="${m}"]`, el).textContent = alloc[m]; }); }
      render();
    });
    function finish() {
      const fr = (v, g) => clamp(v / g, 0, 1);
      const parts = [fr(st.water, GOALS.water), fr(st.o2, GOALS.o2), fr(st.fuel, GOALS.fuel)];
      const score = (parts.reduce((a, b) => a + b, 0) / 3) * 100;
      api.finish(score, [
        `Вода: ${fmt(st.water, 0)} / ${GOALS.water} кг ${parts[0] >= 1 ? '✅' : '❌'}`,
        `Кислород: ${fmt(st.o2, 0)} / ${GOALS.o2} кг ${parts[1] >= 1 ? '✅' : '❌'}`,
        `Топливо: ${fmt(st.fuel, 0)} / ${GOALS.fuel} кг ${parts[2] >= 1 ? '✅' : '❌'}`,
        `Остатки на складе: лёд ${fmt(st.ice, 0)} кг, реголит ${fmt(st.reg, 1)} т, водород ${fmt(st.h2, 1)} кг`,
      ]);
    }
    render();
  }

  Missions.register({
    id: 'isru', role: 'pilot', cat: 'moon', icon: '⛏️', title: 'Использование местных ресурсов',
    short: 'Получить кислород, воду и топливо из лунного реголита и льда',
    facts: [
      'Доставка 1 кг груза на Луну стоит очень дорого, поэтому всё, что можно добыть на месте, сильно удешевляет экспедиции.',
      'Лёд из полярных кратеров плавят в воду, а воду электролизом разлагают на кислород и водород — это и воздух, и ракетное топливо.',
      'В минерале ильмените лунного реголита содержится кислород: при нагреве с водородом из него получается вода.',
      'Лунная ночь длится около 14 земных суток — без Солнца энергию дают только аккумуляторы.',
    ],
    briefing: [
      'Пилот, вы — оператор первой лунной установки ISRU (In-Situ Resource Utilization — использование местных ресурсов).',
      'За 8 смен базе нужно получить <b>300 кг воды</b>, <b>400 кг кислорода</b> для дыхания и <b>250 кг топлива</b> для взлётного модуля.',
      'Цепочка такая: бур добывает лёд → плавильня делает воду → электролизёр разлагает воду на O₂ и H₂ → сжижитель превращает их в топливо. Есть и запасной путь: экскаватор и реактор получают воду из реголита.',
      'Энергии мало, а бур один — так что придётся задействовать оба пути и заранее подготовиться к лунной ночи.',
    ],
    controls: 'Ползунки распределяют мощность, кнопка «Запустить смену» — переход к следующей смене.',
    start,
  });
})();
