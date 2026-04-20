const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');

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
