'use strict';
/* Встраивание отдельных миссий в любой проект.
 *
 *   const game = SpaceMissions.mount('rover', document.getElementById('box'), {
 *     briefing: true,                       // показать брифинг ассистентки перед стартом
 *     onFinish: ({ id, score, stars, details }) => { ... },  // свой обработчик результата
 *   });
 *   game.restart();   // начать заново
 *   game.destroy();   // остановить и очистить контейнер
 *
 * Нужны: css/style.css, js/core.js, js/moon-art.js (для Луны), файл миссии и этот файл.
 */
(function () {
  function mount(id, container, opts = {}) {
    const m = Missions.get(id);
    if (!m) throw new Error(`Миссия «${id}» не найдена. Доступны: ${Missions.list.map((x) => x.id).join(', ')}`);
    let scope = null;

    const clear = () => { if (scope) { scope.dispose(); scope = null; } container.innerHTML = ''; };

    async function briefing() {
      clear();
      const el = h(`<section class="briefing screen">
        <h2>${m.icon} ${m.title}</h2>
        <div class="brief-talk"></div>
        <div class="brief-facts card"><h4>Справка</h4><ul>${m.facts.map((f) => `<li>${f}</li>`).join('')}</ul></div>
        <div class="brief-go hidden"><div class="card controls-card"><h4>Управление</h4><p>${m.controls}</p></div>
          <button class="btn btn-primary big" type="button">🚀 Начать миссию</button></div>
      </section>`);
      container.appendChild(el);
      $('.brief-go button', el).addEventListener('click', play);
      await talk($('.brief-talk', el), m.briefing, { keep: true, lastLabel: 'Всё ясно' });
      if (el.isConnected) $('.brief-go', el).classList.remove('hidden');
    }

    function play() {
      clear();
      scope = new Scope();
      const el = h(`<section class="mission screen">
        <div class="mission-bar"><div class="mb-title">${m.icon} ${m.title}</div></div>
        <div class="mission-hint"></div><div class="mission-root"></div></section>`);
      container.appendChild(el);
      const hintEl = $('.mission-hint', el);
      let finished = false;
      const api = {
        scope,
        hint(text) { hintEl.innerHTML = ''; if (text) hintEl.appendChild(hintBox(text)); },
        finish(score, details = []) {
          if (finished) return;
          finished = true;
          score = Math.round(clamp(score, 0, 100));
          const res = { id: m.id, score, stars: starsFor(score), details };
          if (opts.onFinish) { clear(); opts.onFinish(res); } else result(res);
        },
      };
      m.start($('.mission-root', el), api);
    }

    function result({ score, stars, details }) {
      clear();
      const el = h(`<section class="result screen">
        <h2>${m.icon} ${m.title}: ${score >= 40 ? 'миссия выполнена' : 'миссия провалена'}</h2>
        <div class="result-score card"><div class="score-num">${score}<span>/100</span></div><div class="stars huge">${starStr(stars)}</div></div>
        ${details.length ? `<div class="card"><h4>Отчёт о миссии</h4><ul class="report">${details.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
        <div class="row center"><button class="btn btn-primary" type="button">↻ Пройти ещё раз</button></div></section>`);
      container.appendChild(el);
      $('button', el).addEventListener('click', start);
    }

    const start = () => (opts.briefing === false ? play() : briefing());
    start();
    return { restart: start, destroy: clear };
  }

  window.SpaceMissions = {
    mount,
    list: () => Missions.list.map(({ id, title, role, cat, icon, short }) => ({ id, title, role, cat, icon, short })),
  };
})();
