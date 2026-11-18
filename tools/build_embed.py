#!/usr/bin/env python3
"""Собирает папку embed/: по одному самодостаточному HTML-файлу на каждую миссию.

Каждый файл содержит внутри стили, общее ядро, код миссии и запуск через SpaceMissions.mount.
Запуск из корня проекта:  python3 tools/build_embed.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'embed'

MISSIONS = {
    'earth': 'Наблюдение Земли',
    'spacewalk': 'Выход в открытый космос',
    'docking': 'Стыковка и обслуживание',
    'testflight': 'Испытательный полёт',
    'recon': 'Фотосъёмка и разведка мест посадки',
    'landing': 'Высадка на поверхность',
    'base': 'Строительство базы',
    'isru': 'Использование местных ресурсов',
    'orbiter': 'Орбитальные аппараты',
    'rover': 'Посадочные модули и марсоходы',
}
NEEDS_MOON = {'recon', 'landing'}


def read(rel):
    text = (ROOT / rel).read_text(encoding='utf-8')
    if '</script' in text.lower() or '</style' in text.lower():
        raise SystemExit(f'{rel}: нельзя встроить, в тексте есть закрывающий тег')
    return text


def build(mid, title):
    scripts = ['js/core.js']
    if mid in NEEDS_MOON:
        scripts.append('js/moon-art.js')
    scripts += [f'js/missions/{mid}.js', 'js/embed.js']
    js = '\n'.join(f'/* ===== {s} ===== */\n{read(s)}' for s in scripts)
    return f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;800&display=swap" rel="stylesheet">
<style>
{read('css/style.css')}
</style>
</head>
<body>
<canvas id="stars" aria-hidden="true"></canvas>
<main id="app"></main>
<script>
{js}
SpaceMissions.mount('{mid}', document.getElementById('app'));
</script>
</body>
</html>
'''


def main():
    OUT.mkdir(exist_ok=True)
    for mid, title in MISSIONS.items():
        path = OUT / f'{mid}.html'
        path.write_text(build(mid, title), encoding='utf-8')
        print(f'{path.relative_to(ROOT)}  ({path.stat().st_size // 1024} КБ)')


if __name__ == '__main__':
    main()
