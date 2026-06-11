(function () {
  const NAV_ITEMS = [
    { label: "Фермы", href: "farm/" },
    { label: "Курс", href: "klubhack/" },
    { label: "Калькулятор", href: "calc/" },
    { label: "Оборудование", href: "catalog/" },
    { label: "Контакты", href: "contacts/" },
  ];
  const CABINET_ITEM = { label: "Кабинет", href: "/cabinet/" };

  function getRoot() {
    const script = document.currentScript || document.querySelector('script[src*="kp-header.js"]');
    const src = script?.getAttribute("src") || "./assets/js/kp-header.js";
    return src.replace(/assets\/js\/kp-header\.js(?:\?.*)?$/, "") || "./";
  }

  function normalizePath(path) {
    return String(path || "").replace(/^\/+/, "").replace(/index\.html$/, "");
  }

  function getPagePath(root) {
    const pathname = normalizePath(window.location.pathname);
    const rootPath = normalizePath(new URL(root, window.location.href).pathname);
    return normalizePath(pathname.startsWith(rootPath) ? pathname.slice(rootPath.length) : pathname);
  }

  function getTheme(pagePath) {
    const explicit = document.body?.dataset?.headerTheme;
    if (explicit === "dark" || explicit === "light") return explicit;
    if (!pagePath || pagePath === "") return "dark";
    if (pagePath.startsWith("klubhack/")) return "dark";
    return "light";
  }

  function resolveHref(root, href) {
    if (/^(https?:|tel:|mailto:|#|\/)/.test(href)) return href;
    return `${root}${href}`;
  }

  function isActive(pagePath, href) {
    const normalizedHref = normalizePath(href);
    if (!normalizedHref) return !pagePath;
    return pagePath === normalizedHref || pagePath.startsWith(normalizedHref);
  }

  function createHeader(root, pagePath) {
    const theme = getTheme(pagePath);
    const logo = theme === "dark"
      ? `${root}assets/logo/klubnika-project-logo-peach-420.webp`
      : `${root}assets/logo/klubnika-project-logo-green-420.webp`;

    const header = document.createElement("header");
    header.className = `kp-site-header header--${theme}`;
    header.dataset.kpHeader = "true";
    header.innerHTML = `
      <div class="kp-site-header__inner">
        <a class="kp-site-header__brand" href="${root}" aria-label="Klubnika Project">
          <img src="${logo}" alt="Klubnika Project" />
        </a>
        <nav class="kp-site-header__nav" aria-label="Основная навигация">
          ${NAV_ITEMS.map((item) => `
            <a class="kp-site-header__link${isActive(pagePath, item.href) ? " is-active" : ""}"${item.tabletHidden ? ' data-tablet-hidden="true"' : ""} href="${resolveHref(root, item.href)}">${item.label}</a>
          `).join("")}
        </nav>
        <div class="kp-site-header__actions">
          <a class="kp-site-header__cabinet" href="${resolveHref(root, CABINET_ITEM.href)}">${CABINET_ITEM.label}</a>
          <a class="kp-site-header__cta" href="${root}#contact">Обсудить ферму</a>
          <button class="kp-site-header__toggle" type="button" aria-label="Открыть меню" aria-expanded="false">
            <span></span>
          </button>
        </div>
      </div>
      <nav class="kp-site-header__mobile" aria-label="Мобильная навигация">
        ${NAV_ITEMS.map((item) => `
          <a class="kp-site-header__link${isActive(pagePath, item.href) ? " is-active" : ""}" href="${resolveHref(root, item.href)}">${item.label}</a>
        `).join("")}
        <a class="kp-site-header__link" href="${resolveHref(root, CABINET_ITEM.href)}">${CABINET_ITEM.label}</a>
        <a class="kp-site-header__cta" href="${root}#contact">Обсудить ферму</a>
      </nav>
    `;
    return header;
  }

  function createSpacer() {
    const spacer = document.createElement("div");
    spacer.className = "kp-site-header-spacer";
    spacer.dataset.kpHeaderSpacer = "true";
    spacer.setAttribute("aria-hidden", "true");
    return spacer;
  }

  function mountHeader() {
    if (document.body?.dataset?.kpHeaderDisabled === "true") return;

    const root = getRoot();
    const pagePath = getPagePath(root);
    const header = createHeader(root, pagePath);
    const spacer = createSpacer();
    const existing = document.querySelector("[data-kp-header]");
    document.querySelectorAll("[data-kp-header-spacer]").forEach((element) => element.remove());

    if (existing) {
      existing.replaceWith(header);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }
    header.after(spacer);

    bindHeader(header, spacer);
  }

  function bindHeader(header, spacer) {
    const toggle = header.querySelector(".kp-site-header__toggle");
    const mobileLinks = header.querySelectorAll(".kp-site-header__mobile a");
    const logo = header.querySelector(".kp-site-header__brand img");

    const applyScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    const syncSpacer = () => {
      spacer.style.height = `${Math.ceil(header.getBoundingClientRect().height)}px`;
    };

    const closeMenu = () => {
      header.classList.remove("is-menu-open");
      document.body.classList.remove("kp-menu-open");
      toggle?.setAttribute("aria-expanded", "false");
    };

    toggle?.addEventListener("click", () => {
      const open = !header.classList.contains("is-menu-open");
      header.classList.toggle("is-menu-open", open);
      document.body.classList.toggle("kp-menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    mobileLinks.forEach((link) => link.addEventListener("click", closeMenu));

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) closeMenu();
    });

    window.addEventListener("scroll", applyScroll, { passive: true });
    window.addEventListener("resize", () => {
      if (!window.matchMedia("(max-width: 760px)").matches) closeMenu();
      syncSpacer();
    });
    logo?.addEventListener("load", syncSpacer, { once: true });
    if (window.ResizeObserver) {
      new ResizeObserver(syncSpacer).observe(header);
    }
    syncSpacer();
    applyScroll();
  }

  if (document.body) {
    mountHeader();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHeader);
  } else {
    mountHeader();
  }
})();
