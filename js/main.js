'use strict';
/* ===== Поток игры: приветствие → роль → меню → брифинг → миссия → итог ===== */

const app = document.getElementById('app');
Store.load();
let currentScope = null;

function screen(el) {
  if (currentScope) { currentScope.dispose(); currentScope = null; }
  app.innerHTML = '';
  el.classList.add('screen');
  app.appendChild(el);
  window.scrollTo(0, 0);
  return el;
}

/* ---------- Титульный экран ---------- */
function titleScreen() {
  const d = Store.data;
  const el = screen(h(`
    <section class="title-screen">
      <div class="logo-orbit"><div class="planet"></div><div class="ring"></div><div class="sat">🛰</div></div>
      <h1>Космические миссии</h1>
      <p class="lead">Орбита Земли · Луна · Марс</p>
      <div class="title-actions">
        ${d.role ? `<button class="btn btn-primary big" data-a="continue">Продолжить как ${ROLES[d.role].title.toLowerCase()}${d.name ? ' ' + escapeHtml(d.name) : ''}</button>` : ''}
        <button class="btn ${d.role ? '' : 'btn-primary'} big" data-a="new">${d.role ? 'Начать заново' : 'Начать'}</button>
      </div>
    </section>`));
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'continue') menuScreen();
    if (a.dataset.a === 'new') { Store.reset(); introScreen(); }
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- Приветствие и выбор роли ---------- */
async function introScreen() {
  const el = screen(h('<section class="intro"><div class="intro-stage"></div></section>'));
  const stage = $('.intro-stage', el);
  await talk(stage, [
    'Здравствуйте и добро пожаловать в Центр управления полётами! Меня зовут <b>Эмили Картер</b>, я координатор миссий NASA.',
    'Поздравляю вас с получением должности! 🎉 Ваша кандидатура прошла все этапы отбора, и с сегодняшнего дня вы — часть команды, которая исследует околоземную орбиту, Луну и Марс.',
    'Я буду рядом на каждом задании: объясню, в чём суть миссии, что нужно сделать и на что обратить внимание. Для начала — как мне к вам обращаться?',
  ], { lastLabel: 'Представиться ▸', keep: true });

  const form = h(`
    <form class="card name-form">
      <label for="cname">Ваше имя</label>
      <div class="row"><input id="cname" maxlength="24" placeholder="Например, Алекс" autocomplete="off"><button class="btn btn-primary" type="submit">Готово</button></div>
    </form>`);
  stage.appendChild(form);
  $('#cname', form).focus();
  await new Promise((res) => form.addEventListener('submit', (e) => { e.preventDefault(); res(); }));
  Store.data.name = ($('#cname', form).value.trim() || 'коллега').slice(0, 24);
  Store.save();
  stage.innerHTML = '';
  await talk(stage, [
    `Очень приятно, ${escapeHtml(Store.data.name)}! Теперь самое важное решение: кем вы хотите работать?`,
    '<b>Пилот</b> участвует в миссиях, которые требуют личного присутствия: выходит в открытый космос, испытывает корабли, садится на Луну и строит там базу.',
    '<b>Учёный</b> работает над удалёнными миссиями: следит за погодой и климатом Земли со спутников, управляет аппаратами, снимает Луну и руководит роботами на Марсе.',
  ], { lastLabel: 'Выбрать роль ▸' });
  roleScreen();
}

function roleScreen() {
  const el = screen(h(`
    <section class="roles">
      <h2>Выберите специализацию</h2>
      <p class="muted">От роли зависит, какие миссии появятся в вашем меню. Сменить её можно в любой момент.</p>
      <div class="role-cards">
        ${Object.entries(ROLES).map(([id, r]) => `
          <button class="role-card" data-role="${id}" type="button">
            <div class="role-icon">${r.icon}</div>
            <h3>${r.title}</h3>
            <p>${r.desc}</p>
            <ul>${Missions.list.filter((m) => m.role === id).map((m) => `<li>${m.icon} ${m.title}</li>`).join('')}</ul>
          </button>`).join('')}
      </div>
    </section>`));
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-role]');
    if (!c) return;
    Store.data.role = c.dataset.role;
    Store.save();
    menuScreen(true);
  });
}

/* ---------- Меню миссий ---------- */
function rankTitle(stars, max) {
  const p = stars / max;
  if (p >= 0.9) return 'Легенда агентства';
  if (p >= 0.6) return 'Ведущий специалист';
  if (p >= 0.3) return 'Специалист миссий';
  if (stars > 0) return 'Стажёр';
  return 'Новичок';
}

function menuScreen(firstTime) {
  const d = Store.data;
  const role = ROLES[d.role];
  const mine = Missions.list.filter((m) => m.role === d.role);
  const totalStars = mine.reduce((s, m) => s + starsFor(d.best[m.id] || 0), 0);
  const el = screen(h(`
    <section class="menu">
      <header class="menu-head">
        <div>
          <div class="muted small">${role.icon} ${role.title} · ${rankTitle(totalStars, mine.length * 3)}</div>
          <h2>Ваши миссии${d.name ? `, ${escapeHtml(d.name)}` : ''}</h2>
        </div>
        <div class="menu-stats"><span class="stars-big">★ ${totalStars}/${mine.length * 3}</span>
          <button class="btn small" data-a="role">Сменить роль</button>
          <button class="btn small ghost" data-a="home">На главную</button>
        </div>
      </header>
      <div class="menu-talk"></div>
      ${Object.entries(CATEGORIES).map(([cid, c]) => {
        const ms = mine.filter((m) => m.cat === cid);
        if (!ms.length) return '';
        return `<div class="cat"><h3>${c.title} <span class="muted small">${c.sub}</span></h3>
          <div class="mission-grid">${ms.map((m) => {
            const best = d.best[m.id];
            return `<button class="mission-card" data-m="${m.id}" type="button">
              <div class="m-icon">${m.icon}</div>
              <div class="m-body"><h4>${m.title}</h4><p>${m.short}</p></div>
              <div class="m-score">${best != null ? `<span class="stars">${starStr(starsFor(best))}</span><span class="muted small">рекорд ${best}</span>` : '<span class="badge">новая</span>'}</div>
            </button>`;
          }).join('')}</div></div>`;
      }).join('')}
    </section>`));

  const lines = firstTime
    ? [`Отличный выбор! Как ${role.title.toLowerCase()} вы получаете доступ к ${mine.length} миссиям. Выберите любую — перед стартом я проведу брифинг.`]
    : [totalStars === mine.length * 3 ? 'Все миссии пройдены на максимум. Вы — гордость агентства! Можно сменить роль и попробовать другую специализацию.' : 'С возвращением! Какую миссию берём сегодня?'];
  talk($('.menu-talk', el), lines, { keep: true, lastLabel: 'Ок' });

  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'role') return roleScreen();
    if (a && a.dataset.a === 'home') return titleScreen();
    const m = e.target.closest('[data-m]');
    if (m) briefingScreen(Missions.get(m.dataset.m));
  });
}

/* ---------- Брифинг ---------- */
async function briefingScreen(m) {
  const el = screen(h(`
    <section class="briefing">
      <div class="crumbs"><button class="btn small ghost" data-a="back">◂ К миссиям</button> <span class="muted">${CATEGORIES[m.cat].title}</span></div>
      <h2>${m.icon} ${m.title}</h2>
      <div class="brief-talk"></div>
      <div class="brief-facts card"><h4>Справка</h4><ul>${m.facts.map((f) => `<li>${f}</li>`).join('')}</ul></div>
      <div class="brief-go hidden"><div class="card controls-card"><h4>Управление</h4><p>${m.controls}</p></div>
        <button class="btn btn-primary big" data-a="go">🚀 Начать миссию</button></div>
    </section>`));
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'back') menuScreen();
    if (a.dataset.a === 'go') missionScreen(m);
  });
  await talk($('.brief-talk', el), m.briefing, { keep: true, lastLabel: 'Всё ясно' });
  const go = $('.brief-go', el);
  if (go) go.classList.remove('hidden');
}

/* ---------- Миссия ---------- */
function missionScreen(m) {
  const el = screen(h(`
    <section class="mission">
      <div class="mission-bar">
        <div class="mb-title">${m.icon} ${m.title}</div>
        <button class="btn small ghost" data-a="abort">✕ Прервать</button>
      </div>
      <div class="mission-hint"></div>
      <div class="mission-root"></div>
    </section>`));
  const scope = new Scope();
  currentScope = scope;
  const hintEl = $('.mission-hint', el);
  let finished = false;
  const api = {
    scope,
    hint(text) { hintEl.innerHTML = ''; if (text) hintEl.appendChild(hintBox(text)); },
    finish(score, details = []) {
      if (finished) return;
      finished = true;
      score = Math.round(clamp(score, 0, 100));
      resultScreen(m, score, details);
    },
  };
  $('[data-a="abort"]', el).addEventListener('click', () => {
    if (confirm('Прервать миссию? Прогресс этой попытки не сохранится.')) menuScreen();
  });
  try {
    m.start($('.mission-root', el), api);
  } catch (err) {
    console.error(err);
    $('.mission-root', el).appendChild(h(`<div class="card">Ошибка запуска миссии: ${escapeHtml(err.message)}</div>`));
  }
}

/* ---------- Итог ---------- */
function resultScreen(m, score, details) {
  const d = Store.data;
  const prev = d.best[m.id];
  const record = prev == null || score > prev;
  if (record) { d.best[m.id] = score; Store.save(); }
  const st = starsFor(score);
  const el = screen(h(`
    <section class="result">
      <h2>${m.icon} ${m.title}: ${score >= 40 ? 'миссия выполнена' : 'миссия провалена'}</h2>
      <div class="result-score card">
        <div class="score-num">${score}<span>/100</span></div>
        <div class="stars huge">${starStr(st)}</div>
        ${record && prev != null ? '<div class="badge">Новый рекорд!</div>' : ''}
      </div>
      ${details.length ? `<div class="card"><h4>Отчёт о миссии</h4><ul class="report">${details.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      <div class="result-talk"></div>
      <div class="row center gap">
        <button class="btn" data-a="again">↻ Повторить</button>
        <button class="btn btn-primary" data-a="menu">К миссиям</button>
      </div>
    </section>`));
  const comment = st === 3 ? `Блестяще, ${escapeHtml(d.name)}! Такой результат войдёт в учебники для новых сотрудников.`
    : st === 2 ? 'Отличная работа! Пара мелких недочётов, но миссия — успех.'
      : st === 1 ? 'Задача выполнена, хотя есть над чем поработать. Попробуйте ещё раз — я верю в вас.'
        : 'Не всё пошло по плану, но в космосе так бывает. Разберём отчёт и попробуем снова!';
  talk($('.result-talk', el), [comment], { keep: true, lastLabel: 'Спасибо' });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'again') missionScreen(m);
    if (a.dataset.a === 'menu') menuScreen();
  });
}

titleScreen();
