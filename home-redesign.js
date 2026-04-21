const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

const revealSelectors = [
  '.idea-copy',
  '.idea-step',
  '.author-media',
  '.author-copy',
  '.author-facts li',
  '.video-head > *',
  '.video-feature',
  '.video-topics article',
  '.proof-media',
  '.proof-panel',
  '.calculator-copy',
  '.calc-card',
  '.calc-result-grid article',
  '.system-head > *',
  '.system-media',
  '.system-grid article',
  '.solutions-head > *',
  '.solution-card',
  '.launch-head > *',
  '.launch-visual',
  '.process-roadmap article',
  '.honesty-section > *',
  '.honesty-list article',
  '.catalog-entry-head > *',
  '.component-card',
  '.support-media',
  '.support-copy',
  '.support-list article',
  '.course-copy',
  '.course-panel',
  '.course-media',
  '.course-metrics article',
  '.content-gateway-head > *',
  '.material-link',
  '.final-contact-media',
  '.final-contact-copy',
  '.brief-list article',
];

const photoRevealSelector = [
  '.author-media',
  '.video-feature',
  '.proof-media',
  '.system-media',
  '.launch-visual',
  '.support-media',
  '.course-media',
  '.final-contact-media',
].join(', ');

function setupScrollReveal() {
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;

  const revealItems = [
    ...new Set(revealSelectors.flatMap((selector) => [...document.querySelectorAll(selector)])),
  ];

  if (!revealItems.length) return;

  const groupCounts = new WeakMap();

  revealItems.forEach((item) => {
    const group = item.parentElement || document.body;
    const groupIndex = groupCounts.get(group) || 0;

    groupCounts.set(group, groupIndex + 1);
    item.classList.add('reveal-item');
    item.style.setProperty('--reveal-delay', `${Math.min(groupIndex, 5) * 70}ms`);

    if (item.matches(photoRevealSelector)) {
      item.classList.add('reveal-photo');
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.12,
    }
  );

  revealItems.forEach((item) => observer.observe(item));

  requestAnimationFrame(() => {
    document.body.classList.add('motion-ready');
    document.body.classList.add('hero-entrance-ready');

    window.setTimeout(() => {
      document.body.classList.add('hero-is-visible');
    }, 80);
  });
}

setupScrollReveal();

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

setupSequentialCards('.system-section', '.system-grid article', 1900);
setupSequentialCards('.launch-section', '.process-roadmap article', 1550);
