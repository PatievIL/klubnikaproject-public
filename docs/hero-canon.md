# Klubnika Project Hero Canon

Дата: 2026-04-28

Этот документ фиксирует hero-блок главной страницы как эталон для следующих правок. Пока это канон и аудит, не автоматическая переделка всех страниц.

## Эталон: главная страница

Файлы:

- Разметка: `index.html`
- Стили: `home-redesign.css`
- Фон: `assets/site-drive/for-site/selected/for-site-41-proof.jpg`

Разметка:

```html
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-media" aria-hidden="true">...</div>
  <div class="hero-content">
    <p class="eyebrow">...</p>
    <h1 id="hero-title">...</h1>
    <p class="hero-lead">...</p>
    <div class="hero-actions">...</div>
  </div>
</section>
```

## Шрифт

- Семейство: `Exo 2`, fallback `Arial, sans-serif`.
- Letter spacing: `0`, кроме eyebrow.
- Заголовок не должен получать отрицательный трекинг.
- Важное правило: крупный размер допустим только в первом hero. Внутренние блоки и карточки не повторяют hero-масштаб.

## Desktop Layout

Брейкпоинт: от `1025px`.

Секция:

- selector: `.hero`
- position: `relative`
- display: `grid`
- align-items: `end`
- min-height: `84svh`
- padding: `132px var(--container-gutter) 76px`
- overflow: `hidden`
- color: `#FDF6EA`

Контейнер контента:

- selector: `.hero-content`
- width: `min(1240px, 100%)`
- margin: `0 auto`
- padding-right: `min(34vw, 420px)`
- z-index: `2`
- композиция: контент прижат к низу первого экрана, слева по общей сетке сайта.

При viewport `1280px` фактические замеры:

- hero: `1280 x 798px`
- hero starts after header: `y = 63px`
- content: `x = 32px`, `y = 431px`, `width = 1216px`, `height = 354px`
- контент заканчивается на `y = 785px`, нижний воздух hero около `76px`

При viewport `1440px` фактические замеры:

- hero: `1440 x 798px`
- content: `x = 100px`, `width = 1240px`
- padding-right: `420px`

## Фон И Затемнение

Фоновая картинка:

- `.hero-media img`
- object-fit: `cover`
- object-position desktop: `center 62%`
- object-position tablet/mobile: `58% 58%`

Затемнение:

- основной overlay:
  - `linear-gradient(90deg, rgba(0, 53, 31, 0.92) 0%, rgba(0, 65, 40, 0.74) 42%, rgba(0, 36, 24, 0.24) 100%)`
  - `linear-gradient(180deg, rgba(10, 20, 14, 0.16) 0%, rgba(10, 20, 14, 0.42) 100%)`
- нижняя подложка:
  - `.hero::after`
  - height: `34%`
  - gradient to warm beige `rgba(245, 236, 223, 0.86)`

Назначение overlay: заголовок читается на тёмной левой части, правая часть остается фотографичной.

## Eyebrow

Selector: `.eyebrow`

- color: `#E5C794`
- font-size desktop: `12px`
- font-weight: `850`
- letter-spacing: `0.08em`
- text-transform: `uppercase`
- margin-bottom: `18px`
- mobile: `11px`, margin-bottom `14px`

Функция: не маркетинговый слоган, а технический контекст страницы.

## H1

Selector: `h1` внутри главного hero.

- max-width desktop: `720px`
- margin-bottom: `22px`
- font-size: `clamp(42px, 5.55vw, 78px)`
- line-height: `1.08`
- font-weight фактически: `700`
- letter-spacing: `0`
- color: `#FDF6EA`

Фактические размеры:

- `1440px`: `78px`, line-height `84.24px`, width `720px`
- `1280px`: `71.04px`, line-height `76.72px`, width `720px`
- `1024px`: `56.83px`, line-height `61.38px`, width `612px`
- `768px`: `74px`, line-height `79.92px`, width `700px`
- `430px`: `36.98px`, line-height `37.72px`, width `336px`
- `390px`: `34px`, line-height `34.68px`, width `336px`

Важно:

- В hero главной заголовок большой, но строка короткая.
- Нельзя переносить этот масштаб на длинные заголовки других страниц без сокращения текста.
- Если заголовок длиннее 3-4 слов в строке, размер надо снижать или менять формулировку.

## Lead

Selector: `.hero-lead`

- max-width desktop: `660px`
- margin-bottom: `34px`
- color: `#FDF6EA` с opacity около `0.93`
- font-size: `clamp(19px, 1.75vw, 25px)`
- font-weight: `520`
- line-height: `1.48`

Фактические размеры:

- `1440px`: `25px`, line-height `37px`, width `660px`
- `1280px`: `22.4px`, line-height `33.15px`, width `660px`
- `1024px`: `19px`, line-height `28.12px`, width `612px`
- `768px`: `18px`, line-height `26.64px`, width `620px`
- `390-430px`: `16px`, line-height `23.68px`, width около `340px`

Функция: одна короткая расшифровка пользы. Не второй заголовок.

## Actions

Selector: `.hero-actions`

- display: `flex`
- flex-wrap: `wrap`
- gap: `12px`
- desktop button height: `46px`
- mobile: actions become grid, primary button full width.

Primary:

- `.btn.btn-primary`
- min-height desktop: `46px`
- mobile: `48px`
- padding: `0 20px`
- border-radius: `14px`
- background: `#004D2B`
- text: `#F5ECDF`
- font-size: `15px`
- font-weight: `750`

Secondary text link:

- `.hero-text-link`
- min-height: `46px`
- font-size: `14px`
- font-weight: `680`
- underline offset: `5px`
- color: warm white with opacity около `0.84`

Правило: в hero лучше одна основная кнопка и одна тихая ссылка. Не ставить две одинаково сильные CTA.

## Mobile Layout

Брейкпоинт: `max-width: 640px`.

Секция:

- min-height: `auto`
- padding: `112px 16px 42px`
- lower beige fade disabled: `.hero::after { display: none; }`

Content:

- content width: viewport minus `32px`
- `h1 max-width: min(100%, 336px)`
- lead max-width: `340px`
- actions: grid
- buttons: full width

Фактические замеры:

- `430px`: hero height `475px`, content `x = 16px`, title `36.98px`
- `390px`: hero height `469px`, content `x = 16px`, title `34px`

## Hero Families Found In Project

### Close to canon

- `/` main hero: canonical.
- `/calc/`: visually close. Same photo logic, same green overlay, same `Exo 2`, same primary button height. Differences:
  - wrapper is `.calc-intro`, not `.hero`;
  - min-height fixed `640px`, not `84svh`;
  - title is larger/tighter: `clamp(44px, 6.1vw, 82px)`, line-height `0.96`;
  - lead is smaller: max `21px`, weight `450`;
  - only one action button.

### First alignment pass complete

- `/farm/`
- `/study/`
- `/consultations/`

Before alignment at `1280px`:

- title: about `78px`, weight `800`, line-height about `75px`
- lead: `24px`
- primary CTA: `54-58px`
- content starts too high compared with home (`y около 83px` vs home `431px`)

After first alignment pass:

- photo/green-overlay approach kept;
- hero shell now aligns content to the lower part of the first screen;
- desktop title target is `clamp(42px, 5.2vw, 68px)`;
- title weight is `700`;
- lead target is `clamp(18px, 1.75vw, 23px)`;
- CTA height is `48px`;
- tablet gets a separate middle layout instead of dropping straight into mobile scale;
- mobile lead is `16px`, sublead is `15px`.

Measured after pass at `1280px`:

- hero height: `774px`;
- content starts around `y = 260px`;
- title: `66.56px`, weight `700`, line-height `71.88px`;
- lead: `22.4px`;
- primary CTA: `48px`;
- old public headers: `0`;
- horizontal overflow: `false`.

Second density pass:

- removed the third quiet hero link from `/farm/`, `/study/`, `/consultations/`;
- reduced desktop sublead to `16px` with line-height `1.48`;
- removed sublead from mobile hero so the first screen stays closer to the main page;
- removed the remaining mobile `620px` min-height override on `/farm/`.

Mobile measured after second pass:

- `/farm/`: `514-520px` hero height at `390-430px`;
- `/study/`: `540-584px` hero height at `390-430px`;
- `/consultations/`: `516-522px` hero height at `390-430px`;
- old public headers: `0`;
- horizontal overflow: `false`.

Third layout pass:

- `/farm/`, `/study/`, `/consultations/` now use the same desktop hero rhythm as `/`;
- outer `.hero` wrapper has no extra bottom padding on these service pages;
- service hero shell uses `min-height: 84svh` and `padding: 132px 32px 76px` on desktop;
- service h1 uses the main formula `clamp(42px, 5.55vw, 78px)`, `line-height: 1.08`, `font-weight: 700`, with max-width up to `760px` for longer service titles;
- service lead uses `clamp(19px, 1.75vw, 25px)`, `line-height: 1.48`, `margin-bottom: 34px`;
- service CTA row starts directly after lead margin, with primary `46px / 15px / 750` and quiet link `46px / 14px / 680`;
- hero sublead is visually disabled inside the first screen so the hero skeleton remains eyebrow, h1, lead, actions;
- tablet service titles use a reduced scale `clamp(48px, 7.2vw, 64px)` because the page titles are longer than the home title;
- mobile keeps the home rhythm: eyebrow `11px`, title `clamp(34px, 8.6vw, 38px)`, lead `16px`, primary `48px`, quiet link `46px`.

Measured after third pass:

- `1280px`: `/`, `/farm/`, `/study/`, `/consultations/` all start at `y = 63px`, hero height `756px`, content `y = 389px`, h1 `71.04px`, lead `22.4px`, actions `y = 697px`;
- `768px`: service pages align with each other at hero height `684px`, content `y = 375px`, h1 `55.296px`, lead `19px`, buttons `46px`;
- `430px` and `390px`: shared mobile rhythm, no horizontal overflow;
- horizontal overflow: `false` on checked widths.

### Separate intentional direction

- `/klubhack/`

Measured at `1280px`:

- title about `115px`, weight `800`, line-height `101px`.

This page is intentionally course/editorial. Do not force full home hero scale without separate decision. It still should respect:

- one dominant CTA;
- readable lead;
- no unnecessary duplicate buttons;
- no oversized text if title becomes longer.

### Different structural type

- `/catalog/` and catalog category/product pages.
- `/seeds/`
- `/objects/cucumber/`
- `/cabinet/`
- `/docs/*`

These are not all first-screen brand heroes. Some are catalog/product/utility headers. They should inherit color, type rhythm, and spacing discipline, but not necessarily the full home hero composition.

## Normalization Rules

1. Every marketing/service hero should use the same skeleton:
   - media/background;
   - overlay;
   - content container;
   - eyebrow;
   - h1;
   - lead;
   - one primary action plus optional quiet secondary action.
2. Main hero title target:
   - desktop: `56-78px` depending on text length;
   - service pages with long Russian headlines: prefer `56-68px`, not `78px+`.
3. Lead target:
   - desktop: `19-24px`;
   - mobile: `16px`;
   - line-height около `1.45-1.5`.
4. CTA target:
   - desktop: `46-50px`;
   - mobile: `48px`, full width if needed.
5. Content should not start directly under header on photo hero pages. Home reference places content in lower half.
6. Text contrast must come from overlay, not text shadow or extra decorative panels.
7. Do not add cards inside hero unless the page is a tool/product page and the card carries real working value.

## Manual Checkpoints

- `390px`
- `430px`
- `768px`
- `1024px`
- `1280px`
- `1440px`

Check:

- h1 not too big for the sentence;
- lead readable and not visually lost;
- prepositions are not left hanging when avoidable;
- primary action is obvious;
- no horizontal scroll;
- header spacer does not make first screen feel broken;
- photo subject is still visible behind overlay.
