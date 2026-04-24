const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const publicLeadApi = 'https://api.klubnikaproject.ru/site/v1/public/leads';

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    document.body.classList.toggle('is-menu-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;

    nav.classList.remove('is-open');
    document.body.classList.remove('is-menu-open');
    toggle.setAttribute('aria-expanded', 'false');
  });
}

function setupHeroEntrance() {
  if (reduceMotion.matches) return;

  requestAnimationFrame(() => {
    document.body.classList.add('hero-entrance-ready');

    window.setTimeout(() => {
      document.body.classList.add('hero-is-visible');
    }, 80);
  });
}

setupHeroEntrance();

function setupScrollMotion() {
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;

  const groups = [
    ['.idea-section', ['.idea-copy', '.idea-step']],
    ['.author-section', ['.author-media', '.author-copy > .eyebrow', '.author-copy h2', '.author-copy p', '.author-facts li', '.section-actions']],
    ['.video-section', ['.video-head > *', '.video-feature', '.video-topic-card']],
    ['.calculator-preview', ['.calculator-copy > *', '.calc-card-head', '.calc-result-grid article', '.calc-card-note']],
    ['.system-section', ['.system-head > *', '.system-media', '.system-grid article', '.system-actions']],
    ['.launch-section', ['.launch-head', '.launch-visual', '.process-roadmap article', '.launch-actions']],
    ['.support-section', ['.support-media', '.support-copy > .eyebrow', '.support-copy h2', '.support-copy p', '.support-list article', '.support-actions']],
    ['.course-section', ['.course-copy > .eyebrow', '.course-copy h2', '.course-copy p', '.course-metrics article', '.course-actions', '.course-media']],
    ['.final-contact', ['.final-contact-media', '.final-contact-copy > *', '.final-telegram-card', '.final-brief-form']],
  ];

  const animatedElements = [];
  const assembledSections = [];

  groups.forEach(([sectionSelector, childSelectors]) => {
    const section = document.querySelector(sectionSelector);
    if (!section) return;

    section.classList.add('motion-assemble');
    assembledSections.push(section);

    childSelectors.forEach((childSelector, groupIndex) => {
      const children = [...section.querySelectorAll(childSelector)];

      children.forEach((child, childIndex) => {
        child.classList.add('motion-reveal');
        child.style.setProperty('--motion-delay', `${Math.min((groupIndex * 24) + (childIndex * 32), 180)}ms`);

        if (child.matches('.author-media, .support-media, .final-contact-media')) {
          child.classList.add('motion-from-left');
        }

        if (child.matches('.course-media, .calc-card-head, .system-media, .video-feature')) {
          child.classList.add('motion-from-right');
        }

        if (child.matches('.idea-step, .video-topic-card, .system-grid article, .process-roadmap article, .support-list article, .course-metrics article, .final-telegram-card, .final-brief-form, .calc-result-grid article')) {
          child.classList.add('motion-card');
        }

        animatedElements.push(child);
      });
    });
  });

  if (!animatedElements.length) return;

  document.body.classList.add('motion-ready');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        window.setTimeout(() => {
          entry.target.classList.remove('motion-reveal', 'motion-from-left', 'motion-from-right', 'motion-card', 'is-visible');
          entry.target.style.removeProperty('--motion-delay');
        }, 520);
        revealObserver.unobserve(entry.target);
      });
    },
    {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.08,
    }
  );

  const assembleObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-assembled', entry.isIntersecting);
      });
    },
    {
      rootMargin: '-10% 0px -28% 0px',
      threshold: 0.14,
    }
  );

  animatedElements.forEach((element) => revealObserver.observe(element));
  assembledSections.forEach((section) => assembleObserver.observe(section));
}

setupScrollMotion();

function setupSequentialCards(sectionSelector, cardSelector, interval = 1700) {
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;

  const section = document.querySelector(sectionSelector);
  const cards = section ? [...section.querySelectorAll(cardSelector)] : [];

  if (!section || cards.length < 2) return;

  let activeIndex = 0;
  let timer = null;

  const setActive = (index) => {
    activeIndex = index % cards.length;
    cards.forEach((card, cardIndex) => {
      card.classList.toggle('is-current', cardIndex === activeIndex);
    });
  };

  const stop = () => {
    if (!timer) return;

    window.clearInterval(timer);
    timer = null;
  };

  const start = () => {
    if (timer) return;

    setActive(activeIndex);
    timer = window.setInterval(() => {
      setActive(activeIndex + 1);
    }, interval);
  };

  cards.forEach((card, index) => {
    card.addEventListener('pointerenter', () => {
      stop();
      setActive(index);
    });

    card.addEventListener('pointerleave', start);
    card.addEventListener('focusin', () => {
      stop();
      setActive(index);
    });

    card.addEventListener('focusout', start);
  });

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        start();
      } else {
        stop();
      }
    },
    {
      rootMargin: '-8% 0px -20% 0px',
      threshold: 0.12,
    }
  );

  observer.observe(section);
}

setupSequentialCards('.launch-section', '.process-roadmap article', 1550);

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function collectUtmParams() {
  const params = new URLSearchParams(window.location.search || '');
  const utm = {};

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });

  return utm;
}

function detectDeviceType() {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  if (width <= 767) return 'mobile';
  if (width <= 1100) return 'tablet';
  return 'desktop';
}

function detectContactFromText(text) {
  const telegram = text.match(/@[a-zA-Z0-9_]{4,}/)?.[0] || '';
  const phone = text.match(/(?:\+7|8)[\s()\\-]*\d{3}[\s()\\-]*\d{3}[\s()\\-]*\d{2}[\s()\\-]*\d{2}/)?.[0] || '';
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';

  return {
    contact: telegram || phone || email || text,
    telegram,
    phone,
    email,
  };
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Fall back to the textarea copy path below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

function buildFinalBriefPayload(rawText) {
  const contact = detectContactFromText(rawText);
  const briefText = [
    'Главная - быстрые вводные по ферме',
    '',
    `Вводные: ${rawText}`,
    `Страница: ${window.location.href}`,
  ].join('\n');

  return {
    source: 'Главная - финальный CTA',
    route: document.title,
    page_path: window.location.pathname,
    page_title: document.title,
    form_name: 'Главная - одно поле CTA',
    name: '',
    contact: contact.contact,
    email: contact.email,
    phone: contact.phone,
    telegram: contact.telegram,
    stage: '',
    what_needed: rawText,
    message: rawText,
    summary: rawText,
    brief_text: briefText,
    lines: [`Вводные: ${rawText}`],
    page_source: document.title,
    block_source: 'home_final_cta_one_field',
    current_url: window.location.href,
    referrer: document.referrer || '',
    timestamp: new Date().toISOString(),
    device_type: detectDeviceType(),
    utm_params: collectUtmParams(),
    detected_route: 'home_final_cta',
    detected_route_label: 'Финальный CTA главной',
    detected_route_href: './calc/',
    scenario_tags: ['home', 'one_field_cta'],
    project_stage: '',
    current_need: rawText,
    payload: {
      'Свободные вводные': rawText,
    },
  };
}

function setupFinalBriefForm() {
  const form = document.querySelector('[data-final-brief-form]');
  if (!form) return;

  const input = form.querySelector('[data-final-brief-input]');
  const button = form.querySelector('[data-final-brief-button]');
  const status = form.querySelector('[data-final-brief-status]');

  if (!input || !button) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const rawText = normalizeText(input.value);
    if (rawText.length < 12) {
      if (status) status.textContent = 'Напишите хотя бы город, площадь или контакт для ответа.';
      input.focus();
      return;
    }

    const idleLabel = button.textContent;
    const payload = buildFinalBriefPayload(rawText);
    button.textContent = 'Отправляем...';
    button.disabled = true;
    if (status) status.textContent = '';

    try {
      const response = await fetch(publicLeadApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-KP-Requested-With': 'klubnikaproject',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Lead API unavailable');

      input.value = '';
      if (status) status.textContent = 'Вводные отправлены. Если нужен быстрый ответ, продублируйте их в Telegram.';
      button.textContent = 'Отправлено';
    } catch (error) {
      const copied = await copyText(payload.brief_text);
      if (status) {
        status.textContent = copied
          ? 'Система сейчас не ответила. Текст скопирован - можно сразу вставить его в Telegram.'
          : 'Система сейчас не ответила. Напишите эти вводные напрямую в Telegram.';
      }
      button.textContent = idleLabel;
    } finally {
      window.setTimeout(() => {
        button.textContent = idleLabel;
        button.disabled = false;
      }, 1800);
    }
  });
}

setupFinalBriefForm();
