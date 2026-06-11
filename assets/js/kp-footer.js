(function () {
  const FOOTER_COLUMNS = [
    {
      title: "Каталог",
      links: [
        { label: "LED освещение", href: "catalog/linear-led/" },
        { label: "Полив", href: "catalog/irrigation/" },
        { label: "Стеллажи", href: "catalog/racks/" },
        { label: "Обучение", href: "klubhack/" },
      ],
    },
    {
      title: "Связь",
      links: [
        { label: "+7 903 009-49-90", href: "tel:+79030094990" },
        { label: "info@klubnikaproject.ru", href: "mailto:info@klubnikaproject.ru" },
        { label: "WhatsApp", href: "https://wa.me/79030094990", external: true },
        { label: "YouTube", href: "https://www.youtube.com/@Ilya_patiev", external: true },
      ],
    },
    {
      title: "Документы",
      links: [
        { label: "Политика конфиденциальности", href: "docs/policy/" },
        { label: "Оферта", href: "docs/offero/" },
        { label: "Гарантия", href: "docs/warrenty/" },
        { label: "Согласие на обработку ПД", href: "docs/consent/" },
      ],
    },
  ];

  function getRoot() {
    const script = document.currentScript || document.querySelector('script[src*="kp-footer.js"]');
    const src = script?.getAttribute("src") || "./assets/js/kp-footer.js";
    return src.replace(/assets\/js\/kp-footer\.js(?:\?.*)?$/, "") || "./";
  }

  function resolveHref(root, href) {
    if (/^(https?:|tel:|mailto:|#|\/)/.test(href)) return href;
    return `${root}${href}`;
  }

  function createLink(root, link) {
    const attrs = link.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${resolveHref(root, link.href)}"${attrs}>${link.label}</a>`;
  }

  function createFooter(root) {
    const footer = document.createElement("footer");
    footer.className = "home-footer";
    footer.id = "footer";
    footer.setAttribute("aria-label", "Подвал сайта");
    footer.dataset.kpFooter = "true";
    footer.innerHTML = `
      <div class="home-footer-inner">
        <div class="home-footer-lead">
          <a class="home-footer-logo" href="${root}" aria-label="Klubnika Project">
            <img src="${root}assets/logo/klubnika-project-logo-green.svg" alt="Klubnika Project" />
          </a>
        </div>

        <nav class="home-footer-columns" aria-label="Навигация подвала">
          ${FOOTER_COLUMNS.map((column) => `
            <div>
              <span>${column.title}</span>
              ${column.links.map((link) => createLink(root, link)).join("")}
            </div>
          `).join("")}
        </nav>

        <div class="home-footer-bottom">
          <span>Klubnika Project, 2026</span>
          <span>Работаем по России и СНГ</span>
        </div>
      </div>
    `;
    return footer;
  }

  function mountFooter() {
    if (document.body?.dataset?.kpFooterDisabled === "true") return;

    const root = getRoot();
    const footer = createFooter(root);
    const existing = document.querySelector("[data-kp-footer], .home-footer");

    if (existing) {
      existing.replaceWith(footer);
    } else {
      document.body.append(footer);
    }
  }

  if (document.body) {
    mountFooter();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountFooter);
  } else {
    mountFooter();
  }
})();
