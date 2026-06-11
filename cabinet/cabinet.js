const SETTINGS_CACHE_KEY = "klubnikaproject.site.backend.settings.v1";
const CANONICAL_SUPPORT_EMAIL = "info@klubnikaproject.ru";
const MEMBER_SESSION_STORAGE_KEY = "klubnikaproject.member.session.v1";
const CATALOG_CART_STORAGE_KEY = "klubnika.catalog.cart.v1";
const MEMBER_SAVED_STORAGE_KEY = "klubnikaproject.cabinet.saved.v1";
const MEMBER_CALC_NOTES_STORAGE_KEY = "klubnikaproject.cabinet.calc-notes.v1";
const CALC_STATE_STORAGE_KEY = "klubnikaproject.calc.state.v4";
const CALC_CROP_STORAGE_KEY = "klubnikaproject.calc.crop.v1";
const COURSE_WORKBOOK_URL = "https://docs.google.com/spreadsheets/d/1X1ZAYC85jn6DZI9xvmfXvTN2uc9GGnXS7oaeN4y9Gf0/edit?usp=sharing";
const COURSE_WORKBOOK_INTRO = "Рабочая тетрадь — основной инструмент курса. Скопируйте её в свой Google аккаунт, фиксируйте решения по каждому уроку и прикладывайте ссылки на файлы, скрины или расчёты.";
const KINESCOPE_IFRAME_API_URL = "https://player.kinescope.io/latest/iframe.player.js";
const COURSE_AUTO_WATCH_THRESHOLD_PERCENT = 90;

const DEFAULT_SETTINGS = {
  site: {
    projectName: "Klubnika Project",
    supportPhone: "+7 925 583-16-69",
    supportEmail: CANONICAL_SUPPORT_EMAIL,
    supportTelegram: "",
    supportTelegramUrl: "",
  },
  integrations: {
    apiBase: "https://api.klubnikaproject.ru/site/v1",
  },
};

const basePath = detectBasePath();
const routes = {
  shell: routePath("cabinet/"),
  login: routePath("login/"),
  site: routePath(""),
  catalog: routePath("catalog/"),
  calc: routePath("calc/"),
  consultations: routePath("contacts/"),
};

let settings = clone(DEFAULT_SETTINGS);
let currentSession = null;
let kinescopeIframeApiPromise = null;
let kinescopePlayerFactory = null;
const courseAutowatchLessons = new Set();
const courseAutowatchIframes = new Set();

document.addEventListener("DOMContentLoaded", initCabinet);

async function initCabinet() {
  settings = loadCachedSettings();
  const view = document.body.dataset.cabinetView || "shell";
  const localLoginPreview = view === "login" && isLocalPreview();

  if (view === "login") {
    if (!localLoginPreview) {
      await refreshSettings();
    }

    if (localLoginPreview) {
      bindLogin();
      return;
    }

    const session = await fetchActiveSession();
    if (session?.ok) {
      currentSession = session;
      redirectAuthenticatedSession(session);
      return;
    }
    bindLogin();
    return;
  }

  const session = await fetchActiveSession();
  if (!session?.ok) {
    redirectToLogin();
    return;
  }

  currentSession = session;
  await refreshSettings();
  document.body.removeAttribute("data-cabinet-pending");
  renderUserCard(session);
  await renderCabinet(session);
  bindLogout();
}

function detectBasePath() {
  const match = window.location.pathname.match(/^\/(klubnikaproject-(?:next|public))\//);
  return match ? `/${match[1]}/` : "/";
}

function routePath(relativePath = "") {
  return `${basePath}${String(relativePath).replace(/^\//, "")}`;
}

function isLocalPreview() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function cabinetSectionHref(sectionId, params = {}) {
  const search = new URLSearchParams({ section: sectionId });
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return `${routes.shell}?${search.toString()}`;
}

function apiBase() {
  const configured = String(settings.integrations?.apiBase || DEFAULT_SETTINGS.integrations.apiBase).trim().replace(/\/+$/, "");
  if (isLocalPreview()) {
    return "http://127.0.0.1:8010/v1";
  }
  return configured;
}

function loadCachedSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    return normalizeSettings(raw ? merge(clone(DEFAULT_SETTINGS), JSON.parse(raw)) : clone(DEFAULT_SETTINGS));
  } catch {
    return normalizeSettings(clone(DEFAULT_SETTINGS));
  }
}

async function refreshSettings() {
  try {
    const response = await fetch(`${apiBase()}/public/settings`, { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload?.settings) return;
    settings = normalizeSettings(merge(clone(DEFAULT_SETTINGS), payload.settings));
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(payload.settings));
  } catch {
    // cached defaults are enough for the cabinet shell
  }
}

function normalizeSettings(nextSettings) {
  if (!nextSettings.site) nextSettings.site = {};
  nextSettings.site.supportEmail = CANONICAL_SUPPORT_EMAIL;
  return nextSettings;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return patch;
  const output = { ...base };
  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
      output[key] = merge(output[key], value);
      return;
    }
    output[key] = value;
  });
  return output;
}

async function fetchJson(url, options = {}) {
  try {
    const { headers: optionHeaders = {}, ...fetchOptions } = options;
    const method = String(options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...optionHeaders };
    const token = readMemberToken();
    if (token && !headers["X-KP-Member-Session"]) {
      headers["X-KP-Member-Session"] = token;
    }
    if (!["GET", "HEAD"].includes(method) && !headers["X-KP-Requested-With"]) {
      headers["X-KP-Requested-With"] = "klubnikaproject";
    }
    const response = await fetch(url, {
      credentials: "include",
      ...fetchOptions,
      headers,
    });
    if (!response.ok) return { ok: false, status: response.status, text: await response.text() };
    if (response.status === 204) return { ok: true, data: {} };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, text: error.message || "network_error" };
  }
}

function readMemberToken() {
  return readToken(MEMBER_SESSION_STORAGE_KEY);
}

function readToken(key) {
  try {
    const current = window.sessionStorage.getItem(key) || "";
    if (current) return current;
  } catch {
    // ignore storage failures
  }
  try {
    const legacy = window.localStorage.getItem(key) || "";
    if (!legacy) return "";
    window.sessionStorage.setItem(key, legacy);
    window.localStorage.removeItem(key);
    return legacy;
  } catch {
    return "";
  }
}

function storeMemberToken(token) {
  storeToken(MEMBER_SESSION_STORAGE_KEY, token);
}

function storeToken(key, token) {
  try {
    if (token) {
      window.sessionStorage.setItem(key, token);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage failures
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

function clearSessionTokens() {
  storeToken(MEMBER_SESSION_STORAGE_KEY, "");
}

async function fetchActiveSession() {
  const sessionResult = await fetchJson(`${apiBase()}/auth/session`);
  if (!sessionResult.ok || !sessionResult.data?.session) return null;
  const policyResult = await fetchJson(`${apiBase()}/auth/access-policy`);
  return {
    ok: true,
    accountType: "member",
    user: sessionResult.data.user || {},
    policy: policyResult.ok ? policyResult.data.policy || {} : {},
  };
}

function bindLogin() {
  const form = document.getElementById("cabinet-login-form");
  const registerForm = document.getElementById("cabinet-register-form");
  const status = document.getElementById("cabinet-login-status");
  if (!form && !registerForm) return;

  bindAuthTabs(status);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const login = document.getElementById("cabinet-login-identity")?.value.trim() || "";
    const password = document.getElementById("cabinet-login-password")?.value || "";
    if (!login || !password) {
      if (status) status.textContent = "Введите логин и пароль, чтобы открыть кабинет.";
      return;
    }

    if (status) status.textContent = "Проверяем логин и открываем кабинет...";
    const result = await fetchJson(`${apiBase()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });

    if (!result.ok || !result.data?.session_token) {
      if (status) status.textContent = "Не вошли. Проверьте логин и пароль.";
      return;
    }

    storeMemberToken(result.data.session_token);
    const session = await fetchActiveSession();
    if (!session?.ok) {
      if (status) status.textContent = "Вход прошёл, но сессия не открылась. Попробуйте ещё раз.";
      return;
    }

    currentSession = session;
    redirectAuthenticatedSession(session);
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayName = document.getElementById("cabinet-register-name")?.value.trim() || "";
    const email = document.getElementById("cabinet-register-email")?.value.trim() || "";
    const password = document.getElementById("cabinet-register-password")?.value || "";
    if (!displayName || !email || !password) {
      if (status) status.textContent = "Введите имя, email и пароль.";
      return;
    }
    if (password.length < 8) {
      if (status) status.textContent = "Пароль должен быть не короче 8 символов.";
      return;
    }

    if (status) status.textContent = "Создаём кабинет...";
    const result = await fetchJson(`${apiBase()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, email, password }),
    });

    if (!result.ok || !result.data?.session_token) {
      if (status) status.textContent = authErrorMessage(result, "Не удалось зарегистрироваться.");
      return;
    }

    storeMemberToken(result.data.session_token);
    const session = await fetchActiveSession();
    if (!session?.ok) {
      if (status) status.textContent = "Регистрация прошла, но сессия не открылась. Попробуйте войти.";
      return;
    }

    currentSession = session;
    redirectAuthenticatedSession(session);
  });
}

function bindAuthTabs(status) {
  const tabs = Array.from(document.querySelectorAll("[data-cabinet-auth-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-cabinet-auth-panel]"));
  if (!tabs.length || !panels.length) return;

  const activate = (target) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.cabinetAuthTab === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      const active = panel.dataset.cabinetAuthPanel === target;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    if (status) status.textContent = "";
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.cabinetAuthTab || "login"));
  });
}

function authErrorMessage(result, fallback) {
  if (result?.status === 409) return "Этот email уже зарегистрирован. Войдите через вкладку «Вход».";
  if (result?.status === 422) return "Проверьте имя, email и пароль.";
  if (result?.status === 429) return "Слишком много попыток. Попробуйте позже.";
  return fallback;
}

function redirectAuthenticatedSession(session) {
  const next = new URLSearchParams(window.location.search).get("next");
  if (isAllowedCabinetNext(next)) {
    window.location.href = next;
    return;
  }
  window.location.href = cabinetSectionHref(preferredSectionId(session));
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search || ""}`;
  window.location.replace(`${routes.login}?next=${encodeURIComponent(next)}`);
}

function isAllowedCabinetNext(next) {
  return Boolean(next && next.startsWith("/") && !next.startsWith("//"));
}

function bindLogout() {
  document.querySelectorAll("[data-cabinet-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await fetchJson(`${apiBase()}/auth/logout`, { method: "POST" });
      clearSessionTokens();
      window.location.href = routes.login;
    });
  });
}

function getAllowedSections() {
  return [
    { id: "purchase", label: "Покупки", note: "Заказы и корзина." },
    { id: "course", label: "Курс", note: "Уроки и прогресс." },
    { id: "profile", label: "Профиль", note: "Контакты и доставка." },
    { id: "messages", label: "Сообщения", note: "Вопросы команде." },
  ];
}

function preferredSectionId() {
  return "purchase";
}

function normalizeRequestedSectionId(sectionId) {
  const aliases = {
    overview: "purchase",
    catalog: "purchase",
    cart: "purchase",
    orders: "purchase",
    documents: "purchase",
    profile: "profile",
    requests: "calculations",
    special: "calculations",
    course: "course",
  };
  const raw = String(sectionId || "").trim();
  return aliases[raw] || raw || preferredSectionId();
}

async function renderCabinet(session) {
  const sections = getAllowedSections(session);
  const requested = normalizeRequestedSectionId(new URLSearchParams(window.location.search).get("section"));
  const active = sections.some((section) => section.id === requested) ? requested : preferredSectionId(session);
  const nav = document.getElementById("cabinet-nav");
  const content = document.getElementById("cabinet-section-content");
  if (!nav || !content) return;

  nav.innerHTML = sections.map((section) => `
    <a class="cabinet-nav-link${section.id === active ? " is-active" : ""}" href="${escapeAttribute(cabinetSectionHref(section.id))}">
      <strong>${escapeHtml(section.label)}</strong>
      <span>${escapeHtml(section.note)}</span>
    </a>
  `).join("");

  const section = sections.find((item) => item.id === active) || sections[0];
  applyShellModel(session, section);
  content.dataset.section = section.id;
  content.innerHTML = renderCabinetSkeleton(section.label);

  try {
    const html = await renderSection(session, section.id);
    if (content.dataset.section !== section.id) return;
    content.innerHTML = html;
    bindSectionRuntime(session, section.id);
  } catch (error) {
    if (content.dataset.section !== section.id) return;
    content.innerHTML = renderUnavailable(section.label, cleanupError(error.message || "runtime_error"));
  }
}

function renderCabinetSkeleton(label = "Кабинет") {
  return `
    <div class="cabinet-skeleton" aria-label="${escapeAttribute(label)} загружается">
      <span class="cabinet-skeleton__pill"></span>
      <span class="cabinet-skeleton__title"></span>
      <span class="cabinet-skeleton__line"></span>
      <span class="cabinet-skeleton__line cabinet-skeleton__line--short"></span>
      <div class="cabinet-skeleton__grid">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
}

async function renderSection(session, sectionId) {
  if (sectionId === "purchase") return renderPurchaseSection(session);
  if (sectionId === "course") return renderCourseSection(session);
  if (sectionId === "profile") return renderProfileSection(session);
  if (sectionId === "calculations") return renderCalculationsSection(session);
  if (sectionId === "messages") return renderMessagesSection(session);
  return renderUnavailable("Кабинет", "Раздел не найден.");
}

function bindSectionRuntime(session, sectionId) {
  if (sectionId === "purchase") {
    bindCartSection(session);
    bindOrderMessages();
  }
  if (sectionId === "course") bindCourseSection(session);
  if (sectionId === "profile") bindProfileSection(session);
  if (sectionId === "calculations") bindCalculationsSection(session);
  if (sectionId === "messages") bindMessagesSection();
}

function renderUserCard(session) {
  document.body.dataset.cabinetFamily = "user";
  const displayName = getCabinetCustomerLabel(session);
  const email = session?.user?.email || "";
  document.querySelectorAll("[data-cabinet-user]").forEach((target) => {
    target.innerHTML = `
      <div class="cabinet-access-card cabinet-access-card--member">
        <strong class="cabinet-user-name">${escapeHtml(displayName)}</strong>
        ${email ? `<span class="cabinet-user-note">${escapeHtml(email)}</span>` : ""}
      </div>
    `;
  });
}

function applyShellModel(session, section) {
  document.querySelectorAll("[data-cabinet-logout]").forEach((button) => {
    button.hidden = false;
    button.style.display = "";
  });
  setText("[data-cabinet-shell-mode-label]", "Личный кабинет");
  setText("[data-cabinet-shell-meta]", "Личный кабинет");
  setText("[data-cabinet-shell-section-label]", section.label);
  setText("[data-cabinet-shell-section-note]", section.note);
  setText("[data-cabinet-nav-label]", "Меню");
  setText("[data-cabinet-rail-role]", "Кабинет покупателя");
  setLink("[data-cabinet-shell-primary]", "Написать", cabinetSectionHref("messages"));
  setLink("[data-cabinet-shell-secondary]", "Калькулятор", routes.calc);
  setLink("[data-cabinet-shell-tertiary]", "Поддержка", routes.consultations);
  setLink("[data-cabinet-site-link]", "Открыть сайт", routes.site);
}

function renderGuestShell() {
  document.body.dataset.cabinetFamily = "user";
  const loginHref = `${routes.login}?next=${encodeURIComponent(routes.shell)}`;
  const sections = getAllowedSections();
  const nav = document.getElementById("cabinet-nav");
  const content = document.getElementById("cabinet-section-content");
  document.querySelectorAll("[data-cabinet-logout]").forEach((button) => {
    button.hidden = true;
    button.style.display = "none";
  });

  document.querySelectorAll("[data-cabinet-user]").forEach((target) => {
    target.innerHTML = `
      <div class="cabinet-access-card">
        <div class="cabinet-access-title">Доступ</div>
        <div class="cabinet-user-main">
          <strong class="cabinet-user-name">Гость</strong>
          <span class="cabinet-user-note">Войдите, чтобы открыть личные разделы.</span>
        </div>
        <div class="cabinet-pill-row">
          <span class="cabinet-pill is-role">Клиент</span>
          <span class="cabinet-pill is-scope">3 раздела</span>
        </div>
      </div>
    `;
  });

  setText("[data-cabinet-shell-mode-label]", "Личный кабинет");
  setText("[data-cabinet-shell-meta]", "Личный кабинет");
  setText("[data-cabinet-shell-section-label]", "Вход");
  setText("[data-cabinet-shell-section-note]", "После входа появятся покупки, курс и сообщения.");
  setText("[data-cabinet-nav-label]", "Меню");
  setText("[data-cabinet-rail-role]", "Кабинет покупателя");
  setLink("[data-cabinet-shell-primary]", "Войти", loginHref);
  setLink("[data-cabinet-shell-secondary]", "Открыть калькулятор", routes.calc);
  setLink("[data-cabinet-shell-tertiary]", "Задать вопрос", routes.consultations);

  if (nav) {
    nav.innerHTML = sections.map((section, index) => `
      <a class="cabinet-nav-link${index === 0 ? " is-active" : ""}" href="${escapeAttribute(loginHref)}">
        <strong>${escapeHtml(section.label)}</strong>
        <span>${escapeHtml(section.note)}</span>
      </a>
    `).join("");
  }

  if (content) {
    content.dataset.section = "guest";
    content.innerHTML = `
      <div class="cabinet-section-stack cabinet-guest-shell">
        <div class="cabinet-section-intro">
          <div class="cabinet-kicker">Кабинет</div>
          <h2 class="calc-card-title">Личный кабинет без лишних разделов</h2>
        <p class="sublead">Внутри покупки, курс, профиль и сообщения. Личные данные откроются после входа.</p>
        </div>
        <section class="cabinet-section-grid">
          ${sections.map((section) => `
            <article class="card card-pad cabinet-card cabinet-action-card">
              <div class="cabinet-kicker">${escapeHtml(section.label)}</div>
              <h3 class="calc-card-title">${escapeHtml(section.label)}</h3>
              <p class="sublead">${escapeHtml(section.note)}</p>
              <div class="cabinet-home-actions">
                <a class="btn btn-secondary" href="${escapeAttribute(loginHref)}">Открыть после входа</a>
              </div>
            </article>
          `).join("")}
        </section>
        <div class="cabinet-home-actions">
          <a class="btn btn-primary" href="${escapeAttribute(loginHref)}">Войти в кабинет</a>
          <a class="btn btn-secondary" href="${escapeAttribute(routes.calc)}">Открыть калькулятор</a>
        </div>
      </div>
    `;
  }
}

async function renderPurchaseSection(session) {
  const bundle = await loadMemberProjectBundle(session);
  const [orders, messages] = await Promise.all([
    memberHasScope(session, "orders") ? loadMemberOrders().catch(() => []) : Promise.resolve([]),
    loadMemberMessages().catch(() => []),
  ]);
  const catalogItems = bundle.catalogItems || [];
  const cartEntries = buildCartEntries(catalogItems);
  const savedItems = buildSavedItems(session, catalogItems);
  const selectedOrderId = new URLSearchParams(window.location.search).get("order");
  const selectedOrder = orders.find((order) => String(order.id) === String(selectedOrderId));
  if (selectedOrder) {
    const documents = memberHasScope(session, "documents")
      ? (await loadMemberOrderDocuments(selectedOrder.id).catch(() => [])).map((item) => ({ ...item, orderTitle: selectedOrder.title || `Заказ #${selectedOrder.id || ""}` }))
      : [];
    return renderOrderDetail(selectedOrder, documents, messages);
  }

  const documents = memberHasScope(session, "documents")
    ? (await Promise.all(orders.map(async (order) => {
        const items = await loadMemberOrderDocuments(order.id).catch(() => []);
        return items.map((item) => ({ ...item, orderTitle: order.title || `Заказ #${order.id || ""}` }));
      }))).flat()
    : [];

  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Покупка</div>
        <h2 class="calc-card-title">Мои покупки</h2>
        <p class="sublead">История заказов, купленные продукты, оплата и документы собраны из кабинета.</p>
      </div>
      ${renderPurchaseNextStep(orders, documents, cartEntries)}
      ${renderPurchaseOverview(orders, documents)}
      <div class="cabinet-home-grid cabinet-home-grid--single">
        <div class="cabinet-home-main">
          ${renderOrdersCard(orders, documents)}
          ${renderPurchasedProductsCard(orders)}
          ${renderDocumentsCard(documents, orders)}
          ${renderCartCard(session, cartEntries, orders.length)}
          ${renderSavedCard(session, savedItems)}
        </div>
      </div>
    </div>
  `;
}

function renderCartCard(session, entries, orderCount = 0) {
  return `
    <section class="card card-pad cabinet-card" id="cabinet-cart">
      <div class="cabinet-kicker">Новая закупка</div>
      <h3 class="calc-card-title">${orderCount ? "Корзина для следующего заказа" : "Корзина"}</h3>
      ${entries.length ? `
        <div class="cabinet-home-actions">
          ${memberHasScope(session, "orders")
            ? '<button class="btn btn-primary" type="button" data-member-create-order>Собрать заказ из корзины</button>'
            : `<a class="btn btn-primary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать по корзине</a>`}
          <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Задать вопрос</a>
        </div>
        <div class="cabinet-list">
          <div class="cabinet-list-head cabinet-list-head--catalog">
            <span>Позиция</span><span>Количество</span><span>Действие</span>
          </div>
          <div class="cabinet-list-body">
            ${entries.map(({ product, qty }) => `
              <article class="cabinet-list-row cabinet-list-row--catalog">
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(product.title)}</strong>
                  <span>${escapeHtml(product.summary || humanizeCategory(product.category || product.kind || ""))}</span>
                </div>
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(String(qty))}</strong>
                  <span>${escapeHtml(humanizeCategory(product.category || product.kind || ""))}</span>
                </div>
                <div class="cabinet-list-cell">
                  ${product.path ? `<strong><a href="${escapeAttribute(resolvePublicPath(product.path))}">Открыть</a></strong>` : "<strong>В корзине</strong>"}
                  <span class="cabinet-inline-actions">
                    <button class="btn btn-ghost btn-ghost--small" type="button" data-member-cart-save="${escapeAttribute(product.id)}">В сохранённое</button>
                    <button class="btn btn-ghost btn-ghost--small" type="button" data-member-cart-remove="${escapeAttribute(product.id)}">Убрать</button>
                  </span>
                </div>
              </article>
            `).join("")}
          </div>
        </div>
      ` : `
        ${renderPurchaseEmptyState({
          title: orderCount ? "Корзина свободна для новой закупки" : "Корзина пока пустая",
          text: orderCount ? "История уже купленных продуктов находится выше. Для новой закупки можно написать команде или открыть калькулятор." : "Если закупку нужно собрать вручную, напишите команде или начните с расчёта.",
          actions: [
            { label: "Написать по закупке", href: cabinetSectionHref("messages"), tone: "primary" },
            { label: "Открыть калькулятор", href: routes.calc },
          ],
        })}
      `}
    </section>
  `;
}

function renderPurchaseNextStep(orders, documents, cartEntries) {
  const summary = summarizePurchases(orders, documents);
  const hasCart = cartEntries.length > 0;
  let title = "Собрать первую покупку";
  let text = "Начните с каталога или напишите команде, если закупку нужно собрать под объект и ограничения.";
  let primary = { label: "Перейти в каталог", href: routes.catalog };
  let secondary = { label: "Написать по закупке", href: cabinetSectionHref("messages") };

  if (hasCart) {
    title = "Завершить текущую корзину";
    text = `${cartEntries.length} позиций уже в корзине. Можно собрать заказ или уточнить комплект с командой.`;
    primary = { label: "Проверить корзину", href: "#cabinet-cart" };
  } else if (summary.orderCount) {
    title = documents.length ? "Проверить историю и документы" : "Дождаться документов или задать вопрос";
    text = documents.length
      ? "Заказы и файлы уже собраны ниже. Если что-то не совпадает, напишите команде из кабинета."
      : "Заказы уже в кабинете, но документы пока не загружены. Можно написать команде и уточнить статус.";
    primary = { label: documents.length ? "Открыть документы" : "Спросить по документам", href: documents.length ? "#cabinet-documents" : cabinetSectionHref("messages") };
  }

  return `
    <section class="cabinet-purchase-next">
      <div>
        <div class="cabinet-kicker">Следующий шаг</div>
        <h3 class="calc-card-title">${escapeHtml(title)}</h3>
        <p class="sublead">${escapeHtml(text)}</p>
      </div>
      <div class="cabinet-home-actions">
        <a class="btn btn-primary" href="${escapeAttribute(primary.href)}">${escapeHtml(primary.label)}</a>
        <a class="btn btn-secondary" href="${escapeAttribute(secondary.href)}">${escapeHtml(secondary.label)}</a>
      </div>
    </section>
  `;
}

function renderPurchaseOverview(orders, documents) {
  const summary = summarizePurchases(orders, documents);
  return `
    <div class="cabinet-stat-grid cabinet-stat-grid--member cabinet-purchase-summary">
      ${renderStatCard("Заказы", String(summary.orderCount), summary.orderCount ? `${summary.paidCount} оплачено` : "покупок пока нет")}
      ${renderStatCard("Продукты", String(summary.productCount), summary.productCount ? "в истории покупок" : "нет позиций")}
      ${renderStatCard("Оплата", summary.paymentLabel, summary.amountLabel || (summary.orderCount ? "часть сумм уточняется" : "история пуста"))}
      ${renderStatCard("Документы", String(summary.documentCount), summary.documentCount ? "файлы готовы" : (summary.orderCount ? "пока не загружены" : "пока нет"))}
    </div>
  `;
}

function renderOrdersCard(orders, documents) {
  return `
    <section class="card card-pad cabinet-card cabinet-purchase-history">
      <div class="cabinet-kicker">История</div>
      <h3 class="calc-card-title">История покупок</h3>
      ${orders.length ? `
        <div class="cabinet-purchase-timeline">
          ${orders.map((order) => {
            const lineItems = orderLineItems(order);
            const amount = formatOrderAmount(order);
            const docsCount = documents.filter((item) => String(item.order_id) === String(order.id)).length;
            return `
              <article class="cabinet-purchase-event">
                <div class="cabinet-purchase-event__marker" aria-hidden="true"></div>
                <div class="cabinet-purchase-event__body">
                  <div class="cabinet-purchase-event__head">
                    <div>
                      <strong>${escapeHtml(order.title || `Заказ #${order.id || ""}`)}</strong>
                      <span>${escapeHtml([formatDate(order.created_at), order.order_number ? `N ${order.order_number}` : ""].filter(Boolean).join(" · "))}</span>
                    </div>
                    <div class="cabinet-status-pills">
                      <span class="cabinet-status-pill is-${escapeAttribute(statusTone(order.status))}">${escapeHtml(humanizeOrderStatus(order.status))}</span>
                      <span class="cabinet-status-pill is-${escapeAttribute(statusTone(order.payment_status))}">${escapeHtml(humanizePaymentStatus(order.payment_status))}</span>
                    </div>
                  </div>
                  <div class="cabinet-purchase-event__meta">
                    <span>${escapeHtml(lineItems.length ? `${lineItems.length} позиций` : "позиции не добавлены")}</span>
                    <span>${escapeHtml(amount || "сумма уточняется")}</span>
                    <span>${escapeHtml(docsCount ? `${docsCount} документов` : "документов нет")}</span>
                  </div>
                  ${lineItems.length ? `
                    <div class="cabinet-purchase-products-inline">
                      ${lineItems.slice(0, 4).map((item) => `<span>${escapeHtml(item.title || "Позиция")}</span>`).join("")}
                      ${lineItems.length > 4 ? `<span>+${lineItems.length - 4}</span>` : ""}
                    </div>
                  ` : ""}
                  <div class="cabinet-home-actions">
                    <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("purchase", { order: order.id }))}">Открыть заказ</a>
                    <a class="btn btn-ghost btn-ghost--small" href="${escapeAttribute(cabinetSectionHref("messages"))}">Вопрос по заказу</a>
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      ` : renderPurchaseEmptyState({
        title: "История покупок пока пустая",
        text: "После подтверждения заказа здесь появятся реальные статусы, позиции и суммы.",
        actions: [
          { label: "Написать по заказу", href: cabinetSectionHref("messages"), tone: "primary" },
        ],
      })}
    </section>
  `;
}

function renderPurchasedProductsCard(orders) {
  const products = summarizePurchasedProducts(orders);
  return `
    <section class="card card-pad cabinet-card">
      <div class="cabinet-kicker">Товары</div>
      <h3 class="calc-card-title">Купленные продукты</h3>
      ${products.length ? `
        <div class="cabinet-list">
          <div class="cabinet-list-head cabinet-list-head--purchases">
            <span>Продукт</span><span>Количество</span><span>Оплата</span><span>Заказы</span>
          </div>
          <div class="cabinet-list-body">
            ${products.map((product) => `
              <article class="cabinet-list-row cabinet-list-row--purchases">
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(product.title)}</strong>
                  <span>${escapeHtml(product.category || product.summary || "покупка")}</span>
                </div>
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(String(product.quantity || 1))}</strong>
                  <span>${escapeHtml(product.priceLabel || "цена уточняется")}</span>
                </div>
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(product.paymentLabel)}</strong>
                  <span>${escapeHtml(product.amountLabel || "сумма уточняется")}</span>
                </div>
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(String(product.orderCount))}</strong>
                  <span>${product.lastOrderId ? `<a href="${escapeAttribute(cabinetSectionHref("purchase", { order: product.lastOrderId }))}">последний заказ</a>` : "история"}</span>
                </div>
              </article>
            `).join("")}
          </div>
        </div>
      ` : renderPurchaseEmptyState({
        title: "Купленные продукты пока не добавлены",
        text: "Когда появятся оплаченные заказы, товары соберутся здесь в одну понятную историю.",
        actions: [
          { label: "Задать вопрос", href: cabinetSectionHref("messages"), tone: "primary" },
        ],
      })}
    </section>
  `;
}

function renderDocumentsCard(documents, orders) {
  return `
    <section class="card card-pad cabinet-card" id="cabinet-documents">
      <div class="cabinet-kicker">Документы</div>
      <h3 class="calc-card-title">Документы по покупкам</h3>
      ${documents.length ? `
        <div class="cabinet-list cabinet-list--documents-window">
          <div class="cabinet-list-head cabinet-list-head--documents">
            <span>Документ</span><span>Заказ</span><span>Статус</span><span>Открыть</span>
          </div>
          <div class="cabinet-list-body">
            ${documents.map(renderDocumentRow).join("")}
          </div>
        </div>
      ` : renderPurchaseEmptyState({
        title: orders.length ? "Документы пока не загружены" : "Документов пока нет",
        text: orders.length ? "Когда появятся счета, спецификации или PDF, они будут здесь." : "После подтверждения заказа сюда попадут счета, спецификации и другие файлы.",
        actions: [
          { label: orders.length ? "Спросить по документам" : "Написать команде", href: cabinetSectionHref("messages"), tone: "primary" },
        ],
      })}
    </section>
  `;
}

function renderPurchaseEmptyState({ title, text, actions = [] } = {}) {
  return `
    <div class="account-empty cabinet-purchase-empty">
      <div>
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
        ${text ? `<span>${escapeHtml(text)}</span>` : ""}
      </div>
      ${actions.length ? `
        <div class="cabinet-home-actions">
          ${actions.map((action) => `<a class="btn ${action.tone === "primary" ? "btn-primary" : "btn-secondary"}" href="${escapeAttribute(action.href)}">${escapeHtml(action.label)}</a>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function summarizePurchases(orders, documents) {
  const orderCount = orders.length;
  const paidCount = orders.filter((order) => String(order.payment_status || "").toLowerCase() === "paid").length;
  const productCount = orders.reduce((sum, order) => sum + orderLineItems(order).length, 0);
  const total = orders.reduce((sum, order) => {
    const amount = Number(order.total_amount || 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
  return {
    orderCount,
    paidCount,
    productCount,
    documentCount: documents.length,
    paymentLabel: orderCount ? `${paidCount}/${orderCount} оплачено` : "нет заказов",
    amountLabel: total > 0 ? formatOrderAmount({ total_amount: total, currency: orders.find((order) => Number(order.total_amount || 0) > 0)?.currency || "RUB" }) : "",
  };
}

function summarizePurchasedProducts(orders) {
  const byKey = new Map();
  for (const order of orders) {
    for (const item of orderLineItems(order)) {
      const title = String(item.title || item.product_title || item.product_id || "Позиция").trim();
      const key = `${title.toLowerCase()}::${item.product_id || ""}`;
      const existing = byKey.get(key) || {
        title,
        quantity: 0,
        orderCount: 0,
        orderIds: new Set(),
        paymentStatuses: new Set(),
        amount: 0,
        currency: order.currency || "RUB",
        category: item.category || "",
        summary: item.summary || "",
        lastOrderId: order.id,
        priceLabel: "",
      };
      const quantity = Number(item.qty || item.quantity || 1);
      existing.quantity += Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      existing.orderIds.add(order.id);
      existing.orderCount = existing.orderIds.size;
      existing.paymentStatuses.add(order.payment_status || "pending");
      const price = Number(item.price || 0);
      if (Number.isFinite(price) && price > 0) {
        existing.amount += price * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
        existing.priceLabel = formatOrderAmount({ total_amount: price, currency: order.currency || existing.currency });
      }
      existing.lastOrderId = order.id || existing.lastOrderId;
      byKey.set(key, existing);
    }
  }
  return [...byKey.values()]
    .map((item) => ({
      ...item,
      orderIds: undefined,
      paymentLabel: [...item.paymentStatuses].map(humanizePaymentStatus).join(", ") || "Оплата уточняется",
      amountLabel: item.amount > 0 ? formatOrderAmount({ total_amount: item.amount, currency: item.currency }) : "",
    }))
    .sort((a, b) => b.orderCount - a.orderCount || a.title.localeCompare(b.title, "ru"));
}

async function renderProfileSection(session) {
  const profile = await loadMemberProfile(session);
  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Профиль</div>
        <h2 class="calc-card-title">Контакты и доставка</h2>
        <p class="sublead">Эти данные нужны для счёта, документов и отправки заказа.</p>
      </div>
      ${renderProfileNextStep(profile)}
      ${renderProfileCard(profile)}
    </div>
  `;
}

function renderProfileNextStep(profile) {
  const fields = [
    ["display_name", "имя"],
    ["phone", "телефон"],
    ["delivery_address", "адрес доставки"],
  ];
  const missing = fields.filter(([key]) => !String(profile?.[key] || "").trim()).map(([, label]) => label);
  const complete = missing.length === 0;
  return `
    <section class="cabinet-section-next cabinet-profile-next">
      <div>
        <div class="cabinet-kicker">Следующий шаг</div>
        <h3 class="calc-card-title">${complete ? "Профиль готов для заказа" : "Заполнить данные для покупки"}</h3>
        <p class="sublead">${complete ? "Контакты и доставка заполнены. Если условия изменились, обновите данные до следующей закупки." : `Не хватает: ${missing.join(", ")}. Это ускорит счёт, документы и доставку.`}</p>
      </div>
      <div class="cabinet-home-actions">
        <a class="btn btn-primary" href="#cabinet-profile-form">${complete ? "Проверить данные" : "Заполнить профиль"}</a>
        <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Нужна помощь</a>
      </div>
    </section>
  `;
}

function renderProfileCard(profile) {
  return `
    <section class="card card-pad cabinet-card cabinet-profile-card" id="cabinet-profile-form">
      <div class="cabinet-kicker">Данные</div>
      <h3 class="calc-card-title">Контакты и доставка</h3>
      <p class="sublead">Сохраняем только рабочие данные для заказа: контакт, доставка и комментарий для команды.</p>
      <div class="cabinet-field-grid">
        ${renderInput("Имя", "display_name", profile.display_name || "")}
        ${renderInput("Email", "email", profile.email || "", "email", { readonly: true })}
        ${renderInput("Телефон", "phone", profile.phone || "")}
        ${renderTextarea("Адрес доставки", "delivery_address", profile.delivery_address || "", "Город, улица, склад или пункт выдачи")}
        ${renderTextarea("Комментарий к доставке", "delivery_comment", profile.delivery_comment || "", "Кто принимает и когда удобно привезти")}
      </div>
      <div class="cabinet-user-card-actions">
        <button class="btn btn-primary" type="button" data-member-profile-save>Сохранить данные</button>
        <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Нужна помощь</a>
      </div>
      <div class="cabinet-users-status" data-member-profile-status></div>
    </section>
  `;
}

function renderSavedCard(session, items) {
  if (!items.length) return "";
  return `
    <section class="card card-pad cabinet-card">
      <div class="cabinet-kicker">Отложенное</div>
      <h3 class="calc-card-title">Сохранённые позиции</h3>
      <div class="cabinet-mini-list">
        ${items.map((item) => `
          <article class="cabinet-mini-card">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.summary || "Сохранённая позиция")}</span>
            <div class="cabinet-home-actions">
              ${item.path ? `<a class="btn btn-secondary" href="${escapeAttribute(resolvePublicPath(item.path))}">Открыть</a>` : ""}
              <button class="btn btn-ghost btn-ghost--small" type="button" data-member-saved-move="${escapeAttribute(item.id)}">Вернуть в корзину</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOrderDetail(order, documents, messages) {
  const orderMessages = filterMessagesForOrder(order, messages);
  const lineItems = orderLineItems(order);
  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Покупка / заказ</div>
        <h2 class="calc-card-title">${escapeHtml(order.title || `Заказ #${order.id || ""}`)}</h2>
        <p class="sublead">${escapeHtml(`${humanizeOrderStatus(order.status)} · ${humanizePaymentStatus(order.payment_status)}`)}</p>
      </div>
      <div class="cabinet-stat-grid cabinet-stat-grid--member">
        ${renderStatCard("Статус", humanizeOrderStatus(order.status), order.note || "следующий шаг уточнит менеджер")}
        ${renderStatCard("Оплата", humanizePaymentStatus(order.payment_status), formatOrderAmount(order) || "сумма уточняется")}
        ${renderStatCard("Позиции", String(lineItems.length), lineItems.length ? "в составе заказа" : "пока не добавлены")}
        ${renderStatCard("Документы", String(documents.length), documents.length ? "есть файлы" : "пока нет")}
      </div>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">Состав</div>
        <h3 class="calc-card-title">Что в заказе</h3>
        ${lineItems.length ? `
          <div class="cabinet-list">
            <div class="cabinet-list-head cabinet-list-head--catalog">
              <span>Позиция</span><span>Количество</span><span>Категория</span>
            </div>
            <div class="cabinet-list-body">
              ${lineItems.map((item) => `
                <article class="cabinet-list-row cabinet-list-row--catalog">
                  <div class="cabinet-list-cell"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.summary || "")}</span></div>
                  <div class="cabinet-list-cell"><strong>${escapeHtml(String(item.qty || item.quantity || 1))}</strong><span>шт.</span></div>
                  <div class="cabinet-list-cell"><strong>${escapeHtml(humanizeCategory(item.category || ""))}</strong>${item.path ? `<span><a href="${escapeAttribute(resolvePublicPath(item.path))}">Открыть</a></span>` : ""}</div>
                </article>
              `).join("")}
            </div>
          </div>
        ` : '<div class="account-empty">Позиции ещё не добавлены.</div>'}
      </section>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">Документы</div>
        <h3 class="calc-card-title">Файлы по заказу</h3>
        ${documents.length ? `<div class="cabinet-list"><div class="cabinet-list-body">${documents.map(renderDocumentRow).join("")}</div></div>` : '<div class="account-empty">Документов пока нет.</div>'}
      </section>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">Сообщение</div>
        <h3 class="calc-card-title">Написать по заказу</h3>
        ${orderMessages.length ? `<div class="cabinet-message-list">${orderMessages.slice(0, 4).map(renderMessageItem).join("")}</div>` : '<div class="account-empty">Переписки по заказу пока нет.</div>'}
        <label class="cabinet-field">
          <span class="cabinet-field-label">Тема</span>
          <input class="cabinet-input" data-member-order-message-subject="${escapeAttribute(order.id)}" type="text" value="${escapeAttribute(buildOrderMessageSubject(order))}" />
        </label>
        <label class="cabinet-field cabinet-field--wide">
          <span class="cabinet-field-label">Сообщение</span>
          <textarea class="cabinet-textarea" data-member-order-message-body="${escapeAttribute(order.id)}" placeholder="Например: нужен счёт, уточните срок отгрузки, проверьте состав."></textarea>
        </label>
        <div class="cabinet-user-card-actions">
          <button class="btn btn-primary" type="button" data-member-order-message-send="${escapeAttribute(order.id)}">Отправить по заказу</button>
          <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("purchase"))}">Назад к покупке</a>
        </div>
        <div class="cabinet-users-status" data-member-order-message-status="${escapeAttribute(order.id)}"></div>
      </section>
    </div>
  `;
}

async function renderCalculationsSection(session) {
  const snapshot = loadLatestCalculationSnapshot();
  const notes = loadCalculationNotes(session);
  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Расчёты</div>
        <h2 class="calc-card-title">Расчёт калькулятора и пометка</h2>
        <p class="sublead">Фиксируем текущий расчёт и отправляем менеджеру короткий текстовый контекст.</p>
      </div>
      <div class="cabinet-stat-grid cabinet-stat-grid--member">
        ${renderStatCard("Культура", snapshot.exists ? snapshot.cropLabel : "Нет расчёта", snapshot.exists ? "из калькулятора" : "сначала откройте калькулятор")}
        ${renderStatCard("Размер", snapshot.exists ? snapshot.sizeLabel : "-", snapshot.exists ? snapshot.areaLabel : "нет данных")}
        ${renderStatCard("Деньги", snapshot.exists ? snapshot.economyLabel : "-", "из полей калькулятора")}
        ${renderStatCard("Пометки", String(notes.length), notes.length ? "сохранены локально" : "пока нет")}
      </div>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">Текущий расчёт</div>
        <h3 class="calc-card-title">${snapshot.exists ? "Последний расчёт" : "Расчёт ещё не найден"}</h3>
        ${snapshot.exists ? `<div class="cabinet-mini-list cabinet-mini-list--compact">${snapshot.items.map((item) => `<article class="cabinet-mini-card"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span></article>`).join("")}</div>` : '<div class="account-empty">Откройте калькулятор, выставьте параметры и вернитесь сюда.</div>'}
        <div class="cabinet-home-actions">
          <a class="btn btn-primary" href="${escapeAttribute(routes.calc)}">Открыть калькулятор</a>
          <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Открыть сообщения</a>
        </div>
      </section>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">Пометка менеджеру</div>
        <h3 class="calc-card-title">Что важно проверить</h3>
        <label class="cabinet-field cabinet-field--wide">
          <span class="cabinet-field-label">Комментарий к расчёту</span>
          <textarea class="cabinet-textarea" data-member-calc-note placeholder="Например: помещение 4x10 м, хочу понять бюджет и состав комплектации."></textarea>
        </label>
        <div class="cabinet-user-card-actions">
          <button class="btn btn-primary" type="button" data-member-calc-note-send>Отправить менеджеру</button>
          <a class="btn btn-secondary" href="${escapeAttribute(routes.calc)}">Пересчитать</a>
        </div>
        <div class="cabinet-users-status" data-member-calc-note-status></div>
      </section>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">История</div>
        <h3 class="calc-card-title">Последние пометки</h3>
        ${notes.length ? `<div class="cabinet-mini-list">${notes.slice(0, 4).map((item) => `<article class="cabinet-mini-card"><strong>${escapeHtml(item.snapshot?.sizeLabel || "Расчёт")}</strong><span>${escapeHtml(item.note)}</span><span>${escapeHtml(formatDate(item.created_at))}</span></article>`).join("")}</div>` : '<div class="account-empty">Пометок пока нет.</div>'}
      </section>
    </div>
  `;
}

async function renderCourseSection() {
  const course = await loadMemberCourse();
  const modules = Array.isArray(course.modules) ? course.modules : [];
  const lessons = modules.flatMap((module) => module.lessons || []);
  const completed = lessons.filter((lesson) => lesson.status === "completed").length;
  const checked = lessons.filter((lesson) => lesson.status === "checked" || lesson.quiz_passed === true).length;
  const available = lessons.filter((lesson) => lesson.available).length;
  const progressPercent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const nextStep = getCourseNextStep(course);
  const expandedModuleId = findExpandedCourseModuleId(modules);
  const selectedLessonId = new URLSearchParams(window.location.search).get("lesson");
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);

  if (!course.has_access) {
    return `
      <div class="cabinet-section-stack">
        <div class="cabinet-section-intro">
          <div class="cabinet-kicker">Курс</div>
          <h2 class="calc-card-title">${escapeHtml(course.title || "Клубничный Хак")}</h2>
          <p class="sublead">Курс привязан к покупке и ручной выдаче доступа в новом кабинете.</p>
        </div>
        <section class="cabinet-section-next cabinet-course-access">
          <div>
            <div class="cabinet-kicker">Доступ</div>
            <h3 class="calc-card-title">Курс пока закрыт</h3>
            <p class="sublead">Если курс уже оплачен, отправьте сообщение: мы сверим покупку и откроем материалы.</p>
          </div>
          <div class="cabinet-home-actions">
            <a class="btn btn-primary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать по доступу</a>
            <a class="btn btn-secondary" href="${escapeAttribute(routes.site)}klubhack/">Открыть страницу курса</a>
          </div>
        </section>
      </div>
    `;
  }

  if (selectedLesson) {
    const detail = await loadMemberLesson(selectedLesson.id).catch(() => selectedLesson);
    return renderCourseLessonDetail(course, detail);
  }

  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Курс</div>
        <h2 class="calc-card-title">${escapeHtml(course.title || "Клубничный Хак")}</h2>
        <p class="sublead">Доступ активен. Проходите уроки, сдавайте короткие проверки и фиксируйте свой этап.</p>
      </div>
      ${renderCourseNextStep(nextStep)}
      <section class="card card-pad cabinet-card cabinet-course-progress">
        <div class="cabinet-course-progress__head">
          <div>
            <div class="cabinet-kicker">Прогресс курса</div>
            <h3 class="calc-card-title">${escapeHtml(String(progressPercent))}% пройдено</h3>
          </div>
          <span>${escapeHtml(String(completed))} из ${escapeHtml(String(lessons.length))} уроков</span>
        </div>
        <div class="cabinet-course-progress__track" aria-hidden="true">
          <span style="width: ${escapeAttribute(String(progressPercent))}%"></span>
        </div>
        <div class="cabinet-course-stages">
          ${modules.map((module) => renderCourseStage(module)).join("")}
        </div>
      </section>
      <div class="cabinet-stat-grid cabinet-stat-grid--member">
        ${renderStatCard("Доступ", course.has_access ? "Активен" : "Нет", course.has_access ? "доступ сохранён" : "нужна покупка или ручная выдача")}
        ${renderStatCard("Уроки", String(lessons.length), `${available} доступно`)}
        ${renderStatCard("Проверки", String(checked), checked ? "есть результаты тестов" : "пока нет")}
        ${renderStatCard("Пройдено", String(completed), completed ? "прогресс сохранён" : "пока нет")}
      </div>
      <div class="cabinet-course-modules">
        ${modules.map((module) => renderCourseModule(module, module.id === expandedModuleId)).join("")}
      </div>
    </div>
  `;
}

function renderCourseStage(module) {
  const lessons = Array.isArray(module.lessons) ? module.lessons : [];
  const completed = lessons.filter((lesson) => lesson.status === "completed").length;
  const moduleStatus = getCourseModuleStatus(module);
  return `
    <article class="cabinet-course-stage ${moduleStatus.id === "in_progress" || moduleStatus.id === "checked" ? "is-current" : ""} ${moduleStatus.id === "completed" ? "is-done" : ""}">
      <strong>${escapeHtml(module.title || module.id || "Модуль")}</strong>
      <span>${escapeHtml(moduleStatus.label)} · ${escapeHtml(String(completed))}/${escapeHtml(String(lessons.length))}</span>
    </article>
  `;
}

function renderCourseModule(module, expanded = false) {
  const lessons = Array.isArray(module.lessons) ? module.lessons : [];
  const completed = lessons.filter((lesson) => lesson.status === "completed").length;
  const moduleStatus = getCourseModuleStatus(module);
  const available = lessons.filter((lesson) => lesson.available).length;
  return `
    <details class="card card-pad cabinet-card cabinet-course-module" ${expanded ? "open" : ""}>
      <summary class="cabinet-course-module__summary">
        <span>
          <strong>${escapeHtml(module.title || "Модуль курса")}</strong>
        </span>
        <span class="cabinet-course-module__meta">
          ${escapeHtml(moduleStatus.label)} · ${escapeHtml(String(completed))}/${escapeHtml(String(lessons.length))} · ${escapeHtml(String(available))} доступно
        </span>
      </summary>
      <div class="cabinet-course-module__body">
        <p class="sublead">${escapeHtml(module.summary || `${completed} из ${lessons.length} уроков пройдено.`)}</p>
      <div class="cabinet-list">
        <div class="cabinet-list-body">
          ${lessons.map((lesson) => `
            <article class="cabinet-list-row cabinet-list-row--course cabinet-list-row--course-${escapeAttribute(getCourseLessonStatus(lesson).id)}">
              <div class="cabinet-list-cell">
                <strong>${escapeHtml(lesson.title || lesson.id)}</strong>
                <span>${escapeHtml(lesson.summary || lesson.legacy_alias || "")}</span>
              </div>
              <div class="cabinet-list-cell">
                <strong>${escapeHtml(getCourseLessonStatus(lesson).label)}</strong>
                <span>${renderCourseLessonMeta(lesson)}</span>
              </div>
              <div class="cabinet-list-cell">
                ${lesson.available
                  ? `<a class="btn btn-secondary btn-ghost--small" href="${escapeAttribute(cabinetSectionHref("course", { lesson: lesson.id }))}">Открыть</a>`
                  : "<strong>Закрыт</strong>"}
              </div>
            </article>
          `).join("")}
        </div>
      </div>
      </div>
    </details>
  `;
}

function findExpandedCourseModuleId(modules) {
  const list = Array.isArray(modules) ? modules : [];
  return list.find((module) => getCourseModuleStatus(module).id === "in_progress")?.id ||
    list.find((module) => getCourseModuleStatus(module).id === "checked")?.id ||
    list.find((module) => (module.lessons || []).some((lesson) => lesson.available))?.id ||
    list[0]?.id ||
    "";
}

function renderCourseLessonMeta(lesson) {
  const parts = [];
  if (lesson.estimated_minutes) parts.push(`${lesson.estimated_minutes} мин`);
  if (lesson.progress_percent) parts.push(`${lesson.progress_percent}%`);
  if (lesson.quiz_stale) parts.push("тест обновлён");
  else if (lesson.quiz_passed === true) parts.push("тест зачтён");
  else if (lesson.quiz_passed === false) parts.push("тест не зачтён");
  return escapeHtml(parts.join(" · ") || "без прогресса");
}

function renderCourseLessonDetail(course, lesson) {
  const locked = lesson.locked || !lesson.available;
  const quizPassed = lesson.quiz_passed === true;
  const quizChecked = typeof lesson.quiz_passed === "boolean";
  const canCompleteLesson = canCompleteCourseLesson(lesson);
  const nextStep = getCourseNextStep(course, lesson);
  const videoMaterial = getCourseVideoMaterial(lesson.materials);
  const supportingMaterials = getCourseSupportingMaterials(lesson.materials);
  const homeworkMaterials = getCourseHomeworkMaterials(lesson.materials);
  const transcriptMaterials = getCourseTranscriptMaterials(lesson.materials);
  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro cabinet-course-lesson-intro">
        <div class="cabinet-kicker">${escapeHtml(lesson.module_title || course.title || "Курс")}</div>
        <h2 class="calc-card-title">${escapeHtml(lesson.title || "Урок")}</h2>
        <p class="sublead">${locked ? "Урок закрыт до выдачи доступа." : escapeHtml(lesson.summary || "Пройдите материал, выполните действие и сдайте короткую проверку.")}</p>
      </div>
      ${locked ? `
        <section class="cabinet-section-next cabinet-course-access">
          <div>
            <div class="cabinet-kicker">Доступ</div>
            <h3 class="calc-card-title">Нет доступа</h3>
            <p class="sublead">Если курс уже оплачен, напишите команде, чтобы сверить оплату и активировать доступ.</p>
          </div>
          <div class="cabinet-home-actions">
            <a class="btn btn-primary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать по доступу</a>
          </div>
        </section>
      ` : `
        <section class="card card-pad cabinet-card cabinet-course-lesson-shell cabinet-course-lesson-shell--watch">
          <div class="cabinet-course-watch">
            ${renderCourseLessonPlayer(videoMaterial, lesson)}
            ${renderCourseLessonStatusBar(lesson, nextStep, { quizChecked, quizPassed })}
          </div>
        </section>
        <div class="cabinet-course-lesson-grid cabinet-course-lesson-grid--support">
          <article class="cabinet-course-block cabinet-course-block--materials">
            <div class="cabinet-kicker">Материалы урока</div>
            <div class="cabinet-course-block__head">
              <h4>Что разобрать</h4>
              <span>${escapeHtml(videoMaterial?.duration || "материал урока")}</span>
            </div>
            ${renderCourseBulletList(lesson.objectives)}
            ${renderCourseMaterials(supportingMaterials)}
          </article>
          <article class="cabinet-course-block cabinet-course-block--homework" id="course-homework">
            <div class="cabinet-kicker">Домашнее задание</div>
            <div class="cabinet-course-homework">
              <div>
                <h4>Что зафиксировать</h4>
                <p>${escapeHtml(lesson.assignment || "Запишите решение по уроку и следующий шаг.")}</p>
              </div>
              ${renderCourseMaterials(homeworkMaterials)}
              ${renderCourseWorkbook(lesson)}
            </div>
          </article>
        </div>
        ${renderCourseTranscriptBlock(transcriptMaterials)}
        ${renderCourseQuiz(lesson)}
        <section class="card card-pad cabinet-card cabinet-course-actions-card" id="course-actions">
          <div class="cabinet-kicker">Завершение</div>
          <h3 class="calc-card-title">Действия по уроку</h3>
          <div class="cabinet-user-card-actions">
            <button class="btn btn-secondary" type="button" data-course-progress="${escapeAttribute(lesson.id)}" data-course-status="started">Сохранить как начатый</button>
            <button class="btn btn-secondary" type="button" data-course-progress="${escapeAttribute(lesson.id)}" data-course-status="video_watched">Отметить просмотр</button>
            ${canCompleteLesson
              ? `<button class="btn btn-primary" type="button" data-course-progress="${escapeAttribute(lesson.id)}" data-course-status="completed">Отметить урок пройденным</button>`
              : '<button class="btn btn-primary" type="button" disabled>Нужны тест и проверенная домашка</button>'}
            <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("course"))}">К списку уроков</a>
          </div>
          <div class="cabinet-users-status" data-course-progress-status></div>
        </section>
      `}
    </div>
  `;
}

function canCompleteCourseLesson(lesson) {
  return Boolean(
    lesson?.video_watched_at &&
    lesson?.quiz_passed === true &&
    !lesson?.quiz_stale &&
    lesson?.homework?.status === "approved"
  );
}

function renderCourseWorkbook(lesson) {
  const homework = normalizeCourseHomeworkView(lesson.homework);
  return `
    <form class="cabinet-course-workbook" data-course-homework="${escapeAttribute(lesson.id)}">
      <div class="cabinet-course-workbook__intro">
        <div>
          <strong>Рабочая тетрадь курса</strong>
          <p>${escapeHtml(COURSE_WORKBOOK_INTRO)}</p>
        </div>
        <a class="btn btn-secondary" href="${escapeAttribute(COURSE_WORKBOOK_URL)}" target="_blank" rel="noreferrer">Открыть тетрадь</a>
      </div>
      <label class="cabinet-course-workbook__field">
        <span>Ответ ученика</span>
        <textarea data-course-homework-answer rows="5" placeholder="Запишите решение, расчёт, наблюдение или ссылку на заполненный лист тетради.">${escapeHtml(homework.answer)}</textarea>
      </label>
      <label class="cabinet-course-workbook__field">
        <span>Файлы и скрины</span>
        <textarea data-course-homework-attachments rows="3" placeholder="Вставьте ссылки на Google Drive, таблицу, фото, скрины или другие материалы. Одна ссылка — одна строка.">${escapeHtml(homework.attachments.join("\n"))}</textarea>
      </label>
      <div class="cabinet-course-workbook__review">
        <div class="cabinet-course-workbook__status">
          <span>Статус проверки</span>
          <strong>${escapeHtml(humanizeCourseHomeworkStatus(homework.status))}</strong>
        </div>
        <label>
          <span>Комментарий менеджера</span>
          <textarea data-course-homework-manager rows="3" placeholder="Комментарий появится после проверки менеджером." readonly>${escapeHtml(homework.manager_comment)}</textarea>
        </label>
      </div>
      ${renderCourseHomeworkHistory(homework.history)}
      <div class="cabinet-user-card-actions">
        <button class="btn btn-secondary" type="submit" data-homework-save="draft">Сохранить черновик</button>
        <button class="btn btn-primary" type="submit" data-homework-save="submitted">Отправить на проверку</button>
      </div>
    </form>
  `;
}

function normalizeCourseHomeworkView(homework) {
  const source = homework && typeof homework === "object" ? homework : {};
  return {
    answer: String(source.answer || ""),
    attachments: Array.isArray(source.attachments) ? source.attachments.map(String).filter(Boolean) : [],
    status: String(source.status || "draft"),
    manager_comment: String(source.manager_comment || ""),
    history: Array.isArray(source.history) ? source.history : [],
  };
}

function renderCourseHomeworkHistory(history) {
  const items = Array.isArray(history) ? history.filter(Boolean).slice(0, 5) : [];
  if (!items.length) return '<div class="cabinet-course-note">История появится после первого сохранения.</div>';
  return `
    <div class="cabinet-course-workbook__history">
      <strong>История изменений</strong>
      ${items.map((item) => `<span>${escapeHtml(formatCourseHomeworkHistoryItem(item))}</span>`).join("")}
    </div>
  `;
}

function formatCourseHomeworkHistoryItem(item) {
  const status = humanizeCourseHomeworkStatus(item?.status);
  const date = item?.at ? new Date(item.at) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleString("ru-RU") : "без даты";
  return `${dateText} · ${status}`;
}

function renderCourseLessonStatusBar(lesson, nextStep, options = {}) {
  const quizChecked = options.quizChecked || typeof lesson.quiz_passed === "boolean";
  const quizPassed = options.quizPassed || lesson.quiz_passed === true;
  const homeworkStatus = lesson.homework?.status || "draft";
  return `
    <aside class="cabinet-course-statusbar">
      <div class="cabinet-course-statusbar__chips">
        <div><strong>Статус</strong><span>${escapeHtml(getCourseLessonStatus(lesson).label)}</span></div>
        <div><strong>Прогресс</strong><span>${escapeHtml(String(lesson.progress_percent || 0))}%</span></div>
        <div><strong>Видео</strong><span>${lesson.video_watched_at ? "просмотрено" : "не отмечено"}</span></div>
        <div><strong>Тест</strong><span>${lesson.quiz_stale ? "обновлён" : quizChecked ? (quizPassed ? "сдан" : "повторить") : "не сдан"}</span></div>
        <div><strong>Домашка</strong><span>${escapeHtml(humanizeCourseHomeworkStatus(homeworkStatus))}</span></div>
      </div>
      ${renderCourseNextStep(nextStep)}
    </aside>
  `;
}

function getCourseVideoMaterial(items) {
  const materials = Array.isArray(items) ? items : [];
  return materials.find((item) => item?.type === "video" && item.embed_url) || null;
}

function getCourseSupportingMaterials(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.type !== "video" && item?.type !== "transcript" && item?.type !== "worksheet");
}

function getCourseHomeworkMaterials(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.type === "worksheet");
}

function getCourseTranscriptMaterials(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.type === "transcript");
}

function renderCourseLessonPlayer(item, lesson = null) {
  if (!item?.embed_url) {
    return `
      <div class="cabinet-course-player-shell cabinet-course-player-shell--empty">
        <div class="cabinet-kicker">Видео</div>
        <h3>Видео урока готовится</h3>
        <p>Материал появится здесь после публикации.</p>
      </div>
    `;
  }
  return `
    <div class="cabinet-course-player-shell">
      <div class="cabinet-course-player-head">
        <div>
          <div class="cabinet-kicker">Видео урока</div>
          <h3>${escapeHtml(item.title || "Видео урока")}</h3>
        </div>
        <span>${escapeHtml(humanizeCourseMaterialMeta(item))}</span>
      </div>
      ${renderCourseVideoPlayer(item, { lessonId: lesson?.id, watched: Boolean(lesson?.video_watched_at), autowatch: true })}
    </div>
  `;
}

function getCourseNextStep(course, currentLesson = null) {
  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const lessons = modules.flatMap((module) => (module.lessons || []).map((lesson) => ({
    ...lesson,
    module_title: module.title,
  })));
  if (!lessons.length) {
    return {
      tone: "muted",
      kicker: "Следующий шаг",
      title: "Курс готовится",
      body: "Уроки появятся после подключения программы курса.",
    };
  }

  if (currentLesson?.locked || currentLesson && !currentLesson.available) {
    return {
      tone: "locked",
      kicker: "Следующий шаг",
      title: "Активировать доступ",
      body: "Этот урок закрыт. Если курс уже оплачен, напишите команде для сверки доступа.",
      href: cabinetSectionHref("messages"),
      action: "Написать по доступу",
    };
  }

  if (currentLesson && currentLesson.quiz_stale) {
    return {
      tone: "warning",
      kicker: "Следующий шаг",
      title: "Пересдать обновлённый тест",
      body: "Вопросы урока обновились, поэтому старый зачёт больше не учитывается.",
      anchor: "course-quiz",
      action: "Перейти к тесту",
    };
  }

  if (currentLesson && currentLesson.status !== "completed") {
    if (!currentLesson.video_watched_at) {
      return {
        tone: "active",
        kicker: "Следующий шаг",
        title: "Отметить просмотр видео",
        body: "После просмотра видео отметьте этот шаг, затем сдайте тест и отправьте домашку.",
        anchor: "course-homework",
        action: "К кнопкам урока",
      };
    }
    if (currentLesson.quiz_passed !== true) {
      return {
        tone: "active",
        kicker: "Следующий шаг",
        title: "Сдать проверку урока",
        body: "Ответьте на короткий тест. После зачёта можно будет отправить домашку на проверку.",
        anchor: "course-quiz",
        action: "Перейти к тесту",
      };
    }
    if (!["submitted", "needs_revision", "approved"].includes(currentLesson.homework?.status || "draft")) {
      return {
        tone: "active",
        kicker: "Следующий шаг",
        title: "Отправить домашку",
        body: "Заполните рабочую тетрадь и отправьте ответ на проверку менеджеру.",
        anchor: "course-actions",
        action: "К домашке",
      };
    }
    if (currentLesson.homework?.status !== "approved") {
      return {
        tone: "warning",
        kicker: "Следующий шаг",
        title: "Дождаться проверки",
        body: "Домашка отправлена. Урок станет пройденным после принятия менеджером.",
      };
    }
    if (currentLesson.homework?.status === "approved") {
      return {
        tone: "active",
        kicker: "Следующий шаг",
        title: "Завершить урок",
        body: "Видео просмотрено, тест сдан, домашка принята. Теперь можно закрыть урок.",
        anchor: "course-actions",
        action: "К кнопкам урока",
      };
    }
  }

  const startIndex = currentLesson ? Math.max(lessons.findIndex((lesson) => lesson.id === currentLesson.id) + 1, 0) : 0;
  const nextAvailable = lessons.slice(startIndex).find((lesson) => lesson.available && lesson.status !== "completed") ||
    lessons.find((lesson) => lesson.available && lesson.status !== "completed");
  if (nextAvailable) {
    return {
      tone: "active",
      kicker: "Следующий шаг",
      title: nextAvailable.status === "not_started" ? "Открыть следующий урок" : "Продолжить урок",
      body: `${nextAvailable.module_title || "Курс"} · ${nextAvailable.title || nextAvailable.id}`,
      href: cabinetSectionHref("course", { lesson: nextAvailable.id }),
      action: "Открыть урок",
    };
  }

  const nextLocked = lessons.slice(startIndex).find((lesson) => !lesson.available) || lessons.find((lesson) => !lesson.available);
  if (nextLocked) {
    return {
      tone: "locked",
      kicker: "Следующий шаг",
      title: "Разблокировать продолжение",
      body: `${nextLocked.module_title || "Следующий модуль"} · ${nextLocked.title || "следующий урок"} закрыт до выдачи доступа.`,
      href: cabinetSectionHref("messages"),
      action: "Написать по доступу",
    };
  }

  return {
    tone: "done",
    kicker: "Следующий шаг",
    title: "Курс пройден",
    body: "Все доступные уроки закрыты. Можно вернуться к материалам или написать команде по внедрению.",
    href: cabinetSectionHref("messages"),
    action: "Написать команде",
  };
}

function renderCourseNextStep(step) {
  if (!step) return "";
  const action = step.href
    ? `<a class="btn btn-primary" href="${escapeAttribute(step.href)}">${escapeHtml(step.action || "Продолжить")}</a>`
    : step.anchor
      ? `<a class="btn btn-primary" href="#${escapeAttribute(step.anchor)}">${escapeHtml(step.action || "Перейти")}</a>`
      : "";
  return `
    <article class="cabinet-section-next cabinet-course-next cabinet-course-next--${escapeAttribute(step.tone || "active")}">
      <div>
        <div class="cabinet-kicker">${escapeHtml(step.kicker || "Следующий шаг")}</div>
        <h3 class="calc-card-title">${escapeHtml(step.title || "Продолжить курс")}</h3>
        <p class="sublead">${escapeHtml(step.body || "")}</p>
      </div>
      ${action ? `<div class="cabinet-course-next__action">${action}</div>` : ""}
    </article>
  `;
}

function renderCourseBulletList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return '<p class="sublead">Материал урока готовится к публикации.</p>';
  return `<ul class="cabinet-course-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderCourseMaterials(items, options = {}) {
  const includeVideos = options.includeVideos !== false;
  const includeTypes = Array.isArray(options.includeTypes) ? new Set(options.includeTypes) : null;
  const excludeTypes = Array.isArray(options.excludeTypes) ? new Set(options.excludeTypes) : null;
  const materials = (Array.isArray(items) ? items : []).filter((item) => {
    if (!includeVideos && item?.type === "video") return false;
    if (includeTypes && !includeTypes.has(item?.type)) return false;
    if (excludeTypes && excludeTypes.has(item?.type)) return false;
    return true;
  });
  if (!materials.length) return "";
  return `
    <div class="cabinet-course-materials">
      ${materials.map((item) => `
        <div class="cabinet-course-material${item.embed_url ? " cabinet-course-material--video" : ""}">
          <strong>${escapeHtml(item.title || "Материал")}</strong>
          ${renderCourseMaterialMeta(item)}
          ${renderCourseVideoPlayer(item)}
          ${renderCourseTextMaterial(item)}
        </div>
      `).join("")}
    </div>
  `;
}

function renderCourseTranscriptBlock(items) {
  const transcripts = Array.isArray(items) ? items.filter((item) => item?.content || item?.status) : [];
  if (!transcripts.length) return "";
  return `
    <article class="cabinet-course-block cabinet-course-block--transcript">
      <div class="cabinet-kicker">Транскрибация урока</div>
      ${transcripts.map((item) => `
        <details class="cabinet-course-transcript" data-course-transcript>
          <summary>
            <span class="cabinet-course-transcript__summary-text">
              <strong>${escapeHtml(item.title || "Открыть транскрибацию")}</strong>
              <small>Свёрнута под уроком: используйте её для поиска, цитат и повторения, не отвлекаясь от плеера, домашки и теста.</small>
            </span>
            <span class="cabinet-course-transcript__summary-meta">${renderCourseMaterialMeta(item) || "текст урока"}</span>
          </summary>
          ${item.content
            ? `
              <div class="cabinet-course-transcript__tools">
                <label class="cabinet-course-transcript__search">
                  <span>Поиск по тексту</span>
                  <input class="cabinet-input" type="search" placeholder="Найти фразу или таймкод" data-course-transcript-search />
                </label>
                <button class="btn btn-secondary btn-ghost--small" type="button" data-course-transcript-copy>Копировать</button>
                <span class="cabinet-course-transcript__count" data-course-transcript-count>Готово к поиску</span>
              </div>
              <div class="cabinet-course-transcript__body" data-course-transcript-body>${renderCourseTranscriptContent(item.content)}</div>
            `
            : '<div class="cabinet-course-transcript__body cabinet-course-transcript__body--empty">Текст урока готовится.</div>'}
        </details>
      `).join("")}
    </article>
  `;
}

function renderCourseTranscriptContent(content, query = "") {
  const text = String(content || "");
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const lines = text.split(/\r?\n/);
  return lines.map((line) => renderCourseTranscriptLine(line, normalizedQuery)).join("");
}

function renderCourseTranscriptLine(line, normalizedQuery = "") {
  const source = String(line || "");
  const headingMatch = source.match(/^##\s+(.+)$/);
  if (headingMatch) {
    return `<h4 class="cabinet-course-transcript__heading">${highlightCourseTranscriptText(headingMatch[1], normalizedQuery)}</h4>`;
  }
  const timestampMatch = source.match(/^(\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:\s*[–—-]\s*)?)/);
  const timestamp = timestampMatch ? timestampMatch[1] : "";
  const body = timestamp ? source.slice(timestamp.length) : source;
  return `
    <p class="cabinet-course-transcript__line${timestamp ? "" : " cabinet-course-transcript__line--plain"}">
      ${timestamp ? `<span class="cabinet-course-transcript__time">${escapeHtml(timestamp.trim())}</span>` : ""}
      <span>${highlightCourseTranscriptText(timestamp ? body : source, normalizedQuery, Boolean(timestamp))}</span>
    </p>
  `;
}

function highlightCourseTranscriptText(text, normalizedQuery = "", bodyAlreadySliced = false) {
  const source = String(text || "");
  if (!normalizedQuery) return escapeHtml(source);
  const lower = source.toLowerCase();
  let cursor = 0;
  let html = "";
  let index = lower.indexOf(normalizedQuery, cursor);
  while (index !== -1) {
    html += escapeHtml(source.slice(cursor, index));
    html += `<mark>${escapeHtml(source.slice(index, index + normalizedQuery.length))}</mark>`;
    cursor = index + normalizedQuery.length;
    index = lower.indexOf(normalizedQuery, cursor);
  }
  html += escapeHtml(source.slice(cursor));
  return html || (bodyAlreadySliced ? "" : escapeHtml(source));
}

function renderCourseMaterialMeta(item) {
  const meta = humanizeCourseMaterialMeta(item);
  if (!meta) return "";
  return `<span>${escapeHtml(meta)}</span>`;
}

function renderCourseVideoPlayer(item, options = {}) {
  if (!item?.embed_url) return "";
  const lessonId = options.lessonId ? String(options.lessonId) : "";
  const iframeId = lessonId ? `course-video-${lessonId.replace(/[^a-z0-9_-]/gi, "-")}` : "";
  const autowatchAttributes = options.autowatch && lessonId
    ? ` id="${escapeAttribute(iframeId)}" data-course-video-autowatch data-course-video-lesson="${escapeAttribute(lessonId)}" data-course-video-url="${escapeAttribute(item.url || item.embed_url)}" data-course-video-watched="${options.watched ? "true" : "false"}"`
    : "";
  return `
    <div class="cabinet-course-player" data-course-player>
      <iframe
        ${autowatchAttributes}
        src="${escapeAttribute(item.embed_url)}"
        title="${escapeAttribute(item.title || "Видео урока")}"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media;"
        loading="lazy"
      ></iframe>
      <div class="cabinet-course-player__scroll-layer" data-course-player-scroll-layer></div>
      <button class="cabinet-course-player__enable" type="button" data-course-player-enable>
        Смотреть видео
      </button>
    </div>
  `;
}

function renderCourseTextMaterial(item) {
  if (!item?.content) return "";
  return `
    <details class="cabinet-course-text-material">
      <summary>Открыть текст</summary>
      <div>${escapeHtml(item.content).replace(/\n/g, "<br>")}</div>
    </details>
  `;
}

function renderCourseQuiz(lesson) {
  const questions = Array.isArray(lesson.quiz?.questions) ? lesson.quiz.questions : [];
  if (!questions.length) return "";
  return `
    <form class="cabinet-course-quiz" id="course-quiz" data-course-quiz="${escapeAttribute(lesson.id)}">
      <div class="cabinet-course-quiz__head">
        <div>
          <div class="cabinet-kicker">Тест</div>
          <h4>Проверка урока</h4>
        </div>
        <span>${escapeHtml(renderCourseQuizResult(lesson))}</span>
      </div>
      ${questions.map((question, index) => `
        <fieldset class="cabinet-course-question">
          <legend>${escapeHtml(index + 1)}. ${escapeHtml(question.question || "Вопрос")}</legend>
          ${(question.options || []).map((option) => `
            <label class="cabinet-course-option">
              <input
                type="radio"
                name="course-quiz-${escapeAttribute(lesson.id)}-${escapeAttribute(question.id)}"
                value="${escapeAttribute(option.id)}"
                ${lesson.quiz_answers?.[question.id] === option.id ? "checked" : ""}
              />
              <span>${escapeHtml(option.label || option.id)}</span>
            </label>
          `).join("")}
        </fieldset>
      `).join("")}
      <div class="cabinet-user-card-actions">
        <button class="btn btn-primary" type="submit" data-course-quiz-submit="${escapeAttribute(lesson.id)}">Проверить тест</button>
      </div>
    </form>
  `;
}

function renderCourseQuizResult(lesson) {
  if (lesson.quiz_stale) return "тест обновлён, пересдайте";
  if (typeof lesson.quiz_passed !== "boolean") return "ещё не сдавался";
  const score = lesson.quiz_score ?? 0;
  return lesson.quiz_passed ? `зачёт · ${score}%` : `повторить · ${score}%`;
}

async function renderMessagesSection() {
  const messages = await loadMemberMessages().catch(() => []);
  const timeline = [...messages].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const latestTeamMessage = findLatestTeamMessage(timeline);
  const supportPhone = settings.site?.supportPhone || DEFAULT_SETTINGS.site.supportPhone;
  const supportEmail = settings.site?.supportEmail || DEFAULT_SETTINGS.site.supportEmail;
  const supportTelegramUrl = settings.site?.supportTelegramUrl || DEFAULT_SETTINGS.site.supportTelegramUrl;
  const contactLinks = [
    supportTelegramUrl ? `<a href="${escapeAttribute(supportTelegramUrl)}" target="_blank" rel="noreferrer">Telegram</a>` : "",
    supportEmail ? `<a href="mailto:${escapeAttribute(supportEmail)}">email</a>` : "",
    supportPhone ? `<a href="tel:${escapeAttribute(supportPhone.replace(/[^\d+]/g, ""))}">звонок</a>` : "",
  ].filter(Boolean).join(", ");

  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Сообщения</div>
        <h2 class="calc-card-title">Связь с командой</h2>
        <p class="sublead">Один диалог по подбору, заказу, расчёту и документам.</p>
      </div>
      ${renderMessagesNextStep(timeline, latestTeamMessage)}
      <section class="card card-pad cabinet-card cabinet-message-panel">
        <div class="cabinet-kicker">Диалог</div>
        <h3 class="calc-card-title">Чат по проекту</h3>
        <div class="cabinet-message-shell">
          <div class="cabinet-message-window">
            ${timeline.length ? `<div class="cabinet-message-thread">${timeline.map((item) => renderMessageItem(item, latestTeamMessage?.id)).join("")}</div>` : renderCabinetEmptyState({
              title: "Сообщений пока нет",
              text: "Напишите вопрос по покупке, курсу, расчёту или документам. Ответ появится здесь же.",
            })}
          </div>
          <div class="cabinet-message-composer" id="cabinet-message-composer">
            <label class="cabinet-field">
              <span class="cabinet-field-label">Тема</span>
              <input class="cabinet-input" data-member-message-subject type="text" value="Вопрос по проекту" />
            </label>
            <label class="cabinet-field">
              <span class="cabinet-field-label">Сообщение</span>
              <textarea class="cabinet-textarea" data-member-message-body placeholder="Коротко: что нужно сделать?"></textarea>
            </label>
            <div class="cabinet-message-composer__actions">
              <button class="btn btn-primary" type="button" data-member-message-send>Отправить сообщение</button>
            </div>
            <div class="cabinet-users-status" data-member-message-status></div>
          </div>
        </div>
      </section>
      <div class="cabinet-inline-hint cabinet-message-support">
        <strong>Срочно</strong>
        <span>${contactLinks || "напишите сообщение в форме выше"}.</span>
      </div>
    </div>
  `;
}

function renderMessagesNextStep(timeline, latestTeamMessage) {
  const hasMessages = timeline.length > 0;
  const latestDate = latestTeamMessage?.created_at ? formatDate(latestTeamMessage.created_at) : "";
  return `
    <section class="cabinet-section-next cabinet-message-next">
      <div>
        <div class="cabinet-kicker">Следующий шаг</div>
        <h3 class="calc-card-title">${hasMessages ? "Продолжить диалог" : "Написать первый вопрос"}</h3>
        <p class="sublead">${hasMessages ? `В истории ${timeline.length} сообщений${latestDate ? `, последний ответ команды: ${latestDate}` : ""}. Продолжайте в этом же диалоге, чтобы контекст не потерялся.` : "Опишите задачу коротко: что нужно проверить, какой заказ или расчёт обсуждаем, где удобнее получить ответ."}</p>
      </div>
      <div class="cabinet-home-actions">
        <a class="btn btn-primary" href="#cabinet-message-composer">${hasMessages ? "Ответить" : "Написать вопрос"}</a>
        <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("purchase"))}">К покупкам</a>
      </div>
    </section>
  `;
}

function renderCabinetEmptyState({ title, text } = {}) {
  return `
    <div class="cabinet-rich-empty">
      <div>
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
        ${text ? `<span>${escapeHtml(text)}</span>` : ""}
      </div>
    </div>
  `;
}

function bindMessagesSection() {
  document.querySelector("[data-member-message-send]")?.addEventListener("click", async () => {
    const subjectField = document.querySelector("[data-member-message-subject]");
    const bodyField = document.querySelector("[data-member-message-body]");
    const status = document.querySelector("[data-member-message-status]");
    const subject = subjectField?.value.trim() || "Вопрос по проекту";
    const message = bodyField?.value.trim() || "";
    if (!message) {
      if (status) status.textContent = "Введите текст сообщения.";
      return;
    }
    const sent = await sendMemberMessage({ subject, message }, status);
    if (!sent) return;
    await rerenderCurrentSection();
    const nextStatus = document.querySelector("[data-member-message-status]");
    if (nextStatus) nextStatus.textContent = "Сообщение отправлено.";
  });
}

function bindCalculationsSection(session) {
  document.querySelector("[data-member-calc-note-send]")?.addEventListener("click", async () => {
    const noteField = document.querySelector("[data-member-calc-note]");
    const status = document.querySelector("[data-member-calc-note-status]");
    const note = noteField?.value.trim() || "";
    if (!note) {
      if (status) status.textContent = "Добавьте текст пометки.";
      return;
    }
    const snapshot = loadLatestCalculationSnapshot();
    const sent = await sendMemberMessage({
      subject: "Расчёт калькулятора",
      message: buildCalculationManagerMessage(snapshot, note),
    }, status, "Пометка отправлена менеджеру.");
    if (!sent) return;
    saveCalculationNotes(session, [{ id: `${Date.now()}`, created_at: new Date().toISOString(), note, snapshot }, ...loadCalculationNotes(session)].slice(0, 12));
    await rerenderCurrentSection();
    const nextStatus = document.querySelector("[data-member-calc-note-status]");
    if (nextStatus) nextStatus.textContent = "Пометка отправлена менеджеру.";
  });
}

function bindCourseSection() {
  document.querySelectorAll(".cabinet-course-module").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll(".cabinet-course-module[open]").forEach((item) => {
        if (item !== details) item.open = false;
      });
    });
  });

  bindCourseVideoAutowatch();
  bindCoursePlayerScrollGuards();
  bindCourseTranscriptTools();

  document.querySelectorAll("[data-course-quiz]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const lessonId = form.dataset.courseQuiz;
      const status = document.querySelector("[data-course-progress-status]");
      const answers = collectCourseQuizAnswers(form, lessonId);
      if (!Object.keys(answers).length) {
        if (status) status.textContent = "Выберите ответы в тесте.";
        return;
      }
      if (status) status.textContent = "Проверяем тест...";
      try {
        await saveMemberCourseProgress({
          lesson_id: lessonId,
          status: "checked",
          progress_percent: 70,
          quiz_answers: answers,
        });
        await rerenderCurrentSection();
        const nextStatus = document.querySelector("[data-course-progress-status]");
        if (nextStatus) nextStatus.textContent = "Тест проверен и сохранён.";
      } catch (error) {
        if (status) status.textContent = `Тест не сохранился: ${cleanupError(error.message || "runtime_error")}`;
      }
    });
  });

  document.querySelectorAll("[data-course-progress]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = document.querySelector("[data-course-progress-status]");
      if (status) status.textContent = "Сохраняем прогресс...";
      try {
        const courseStatus = button.dataset.courseStatus || "started";
        await saveMemberCourseProgress({
          lesson_id: button.dataset.courseProgress,
          status: courseStatus,
          progress_percent: progressPercentForCourseAction(courseStatus),
        });
        await rerenderCurrentSection();
        const nextStatus = document.querySelector("[data-course-progress-status]");
        if (nextStatus) nextStatus.textContent = "Прогресс сохранён.";
      } catch (error) {
        if (status) status.textContent = `Не сохранилось: ${cleanupError(error.message || "runtime_error")}`;
      }
    });
  });

  document.querySelectorAll("[data-course-homework]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      const lessonId = form.dataset.courseHomework;
      const status = document.querySelector("[data-course-progress-status]");
      const homeworkStatus = submitter?.dataset.homeworkSave || "draft";
      const homework = collectCourseHomeworkPayload(form, homeworkStatus);
      if (!homework.answer && !homework.attachments.length) {
        if (status) status.textContent = "Добавьте ответ или ссылку на файл.";
        return;
      }
      if (status) status.textContent = homeworkStatus === "submitted" ? "Отправляем домашку..." : "Сохраняем домашку...";
      try {
        await saveMemberCourseProgress({
          lesson_id: lessonId,
          status: "started",
          progress_percent: homeworkStatus === "submitted" ? 85 : 35,
          homework,
        });
        await rerenderCurrentSection();
        const nextStatus = document.querySelector("[data-course-progress-status]");
        if (nextStatus) nextStatus.textContent = homeworkStatus === "submitted" ? "Домашка отправлена на проверку." : "Черновик домашки сохранён.";
      } catch (error) {
        if (status) status.textContent = `Домашка не сохранилась: ${cleanupError(error.message || "runtime_error")}`;
      }
    });
  });
}

function bindCourseTranscriptTools() {
  document.querySelectorAll("[data-course-transcript]").forEach((transcript) => {
    const body = transcript.querySelector("[data-course-transcript-body]");
    const search = transcript.querySelector("[data-course-transcript-search]");
    const count = transcript.querySelector("[data-course-transcript-count]");
    const copyButton = transcript.querySelector("[data-course-transcript-copy]");
    if (!body) return;
    const originalText = body.innerText || "";
    const setCount = (text) => {
      if (!count) return;
      count.textContent = text;
    };

    search?.addEventListener("input", () => {
      const query = search.value.trim();
      body.innerHTML = renderCourseTranscriptContent(originalText, query);
      if (!query) {
        setCount("Готово к поиску");
        return;
      }
      const matches = countTranscriptMatches(originalText, query);
      setCount(matches ? `${matches} совпадений` : "Не найдено");
    });

    copyButton?.addEventListener("click", async () => {
      const copied = await copyTextToClipboard(originalText);
      setCount(copied ? "Текст скопирован" : "Не удалось скопировать");
    });
  });
}

function countTranscriptMatches(text, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return 0;
  const haystack = String(text || "").toLowerCase();
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {
    // Fall through to the textarea fallback below.
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "-1000px";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

function bindCoursePlayerScrollGuards() {
  document.querySelectorAll("[data-course-player]").forEach((player) => {
    const enableButton = player.querySelector("[data-course-player-enable]");
    const scrollLayer = player.querySelector("[data-course-player-scroll-layer]");
    if (!enableButton) return;

    scrollLayer?.addEventListener("wheel", (event) => {
      if (player.classList.contains("is-video-active")) return;
      event.preventDefault();
      window.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: "auto",
      });
    }, { passive: false });

    enableButton.addEventListener("click", () => {
      player.classList.add("is-video-active");
    });

    player.addEventListener("mouseleave", () => {
      player.classList.remove("is-video-active");
    });
  });
}

function bindCourseVideoAutowatch() {
  const iframes = Array.from(document.querySelectorAll("iframe[data-course-video-autowatch]"))
    .filter((iframe) => iframe.id && iframe.dataset.courseVideoLesson && iframe.dataset.courseVideoWatched !== "true");
  if (!iframes.length) return;

  loadKinescopeIframeApi()
    .then((playerFactory) => {
      iframes.forEach((iframe) => bindKinescopePlayerAutowatch(playerFactory, iframe));
    })
    .catch(() => {
      const status = document.querySelector("[data-course-progress-status]");
      if (status) status.textContent = "Автопометка видео недоступна, можно отметить просмотр кнопкой ниже.";
    });
}

function loadKinescopeIframeApi() {
  if (kinescopePlayerFactory) return Promise.resolve(kinescopePlayerFactory);
  if (kinescopeIframeApiPromise) return kinescopeIframeApiPromise;

  kinescopeIframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onKinescopeIframeAPIReady;
    window.onKinescopeIframeAPIReady = (playerFactory) => {
      kinescopePlayerFactory = playerFactory;
      if (typeof previousReady === "function" && previousReady !== window.onKinescopeIframeAPIReady) {
        try {
          previousReady(playerFactory);
        } catch {
          // Third-party callbacks should not block the course UI.
        }
      }
      resolve(playerFactory);
    };

    const existing = document.querySelector(`script[src="${KINESCOPE_IFRAME_API_URL}"]`);
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("kinescope_api_error")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = KINESCOPE_IFRAME_API_URL;
    script.async = true;
    script.onerror = () => reject(new Error("kinescope_api_error"));
    document.head.appendChild(script);
  });

  return kinescopeIframeApiPromise;
}

function bindKinescopePlayerAutowatch(playerFactory, iframe) {
  if (!playerFactory?.create || courseAutowatchIframes.has(iframe.id)) return;
  courseAutowatchIframes.add(iframe.id);

  const lessonId = iframe.dataset.courseVideoLesson;
  playerFactory.create(iframe.id, {
    url: iframe.dataset.courseVideoUrl || iframe.src,
    size: { width: "100%", height: "100%" },
  }).then((player) => {
    if (!player?.on || !player.Events) return;

    player.on(player.Events.TimeUpdate, (event) => {
      const percent = Number(event?.data?.percent);
      if (Number.isFinite(percent) && percent >= COURSE_AUTO_WATCH_THRESHOLD_PERCENT) {
        markCourseVideoWatchedAutomatically(lessonId);
      }
    });

    player.on(player.Events.Ended, () => {
      markCourseVideoWatchedAutomatically(lessonId);
    });
  }).catch(() => {
    courseAutowatchIframes.delete(iframe.id);
  });
}

async function markCourseVideoWatchedAutomatically(lessonId) {
  if (!lessonId || courseAutowatchLessons.has(lessonId)) return;
  courseAutowatchLessons.add(lessonId);

  const status = document.querySelector("[data-course-progress-status]");
  if (status) status.textContent = "Отмечаем просмотр видео...";

  try {
    await saveMemberCourseProgress({
      lesson_id: lessonId,
      status: "video_watched",
      progress_percent: progressPercentForCourseAction("video_watched"),
    });
    const button = document.querySelector(`[data-course-progress="${cssEscape(lessonId)}"][data-course-status="video_watched"]`);
    if (button) {
      button.disabled = true;
      button.textContent = "Просмотр отмечен";
    }
    if (status) status.textContent = "Видео просмотрено. Можно сдавать тест и отправлять домашку.";
  } catch (error) {
    courseAutowatchLessons.delete(lessonId);
    if (status) status.textContent = `Автопометка не сохранилась: ${cleanupError(error.message || "runtime_error")}`;
  }
}

function progressPercentForCourseAction(status) {
  const values = {
    started: 10,
    video_watched: 35,
    completed: 100,
  };
  return values[status] || 10;
}

function collectCourseHomeworkPayload(form, status) {
  const answer = form.querySelector("[data-course-homework-answer]")?.value.trim() || "";
  const attachmentText = form.querySelector("[data-course-homework-attachments]")?.value || "";
  return {
    answer,
    attachments: attachmentText.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 12),
    status,
    updated_at: new Date().toISOString(),
  };
}

function collectCourseQuizAnswers(form, lessonId) {
  const answers = {};
  form.querySelectorAll("fieldset").forEach((fieldset) => {
    const input = fieldset.querySelector("input[type='radio']");
    if (!input?.name) return;
    const checked = fieldset.querySelector("input[type='radio']:checked");
    const questionId = input.name.replace(`course-quiz-${lessonId}-`, "");
    if (questionId && checked?.value) answers[questionId] = checked.value;
  });
  return answers;
}

function bindProfileSection(session) {
  document.querySelector("[data-member-profile-save]")?.addEventListener("click", async () => {
    const status = document.querySelector("[data-member-profile-status]");
    if (status) status.textContent = "Сохраняем...";
    const payload = {
      display_name: readProfileField("display_name"),
      email: readProfileField("email"),
      phone: readProfileField("phone"),
      delivery_address: readProfileField("delivery_address"),
      delivery_comment: readProfileField("delivery_comment"),
    };
    try {
      const profile = await saveMemberProfile(payload);
      currentSession.user = { ...currentSession.user, ...profile };
      await rerenderCurrentSection();
      const nextStatus = document.querySelector("[data-member-profile-status]");
      if (nextStatus) nextStatus.textContent = "Сохранено.";
    } catch (error) {
      if (status) status.textContent = `Не сохранилось: ${cleanupError(error.message || "runtime_error")}`;
    }
  });
}

function bindOrderMessages() {
  document.querySelectorAll("[data-member-order-message-send]").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.memberOrderMessageSend;
      const subject = document.querySelector(`[data-member-order-message-subject="${cssEscape(orderId)}"]`)?.value.trim() || "Сообщение по заказу";
      const bodyField = document.querySelector(`[data-member-order-message-body="${cssEscape(orderId)}"]`);
      const status = document.querySelector(`[data-member-order-message-status="${cssEscape(orderId)}"]`);
      const message = bodyField?.value.trim() || "";
      if (!message) {
        if (status) status.textContent = "Введите текст сообщения.";
        return;
      }
      const sent = await sendMemberMessage({ subject, message }, status);
      if (!sent) return;
      await rerenderCurrentSection();
      const nextStatus = document.querySelector(`[data-member-order-message-status="${cssEscape(orderId)}"]`);
      if (nextStatus) nextStatus.textContent = "Сообщение отправлено.";
    });
  });
}

function bindCartSection(session) {
  document.querySelector("[data-member-create-order]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const cartEntries = Object.entries(loadCart()).filter(([, qty]) => (Number(qty) || 0) > 0);
    if (!cartEntries.length) {
      await rerenderCurrentSection();
      return;
    }
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Собираем заказ...";
    try {
      const catalogItems = await loadMemberCatalogItems().catch(() => []);
      const lineItems = cartEntries.map(([productId, qty]) => {
        const product = normalizeCartProduct(productId, findCatalogCartItem(productId, catalogItems));
        return {
          product_id: product.id,
          title: product.title || product.name || product.id,
          path: product.path || "",
          category: product.category || product.kind || "",
          summary: product.summary || "",
          qty: Number(qty) || 1,
        };
      });
      const created = await createMemberOrder({
        title: "Заказ из корзины",
        note: `Добавлено ${lineItems.length} ${pluralizeRu(lineItems.length, "позиция", "позиции", "позиций")} из корзины.`,
        line_items: lineItems,
      });
      saveCart({});
      window.location.href = cabinetSectionHref("purchase", { order: created?.id || "" });
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      window.alert(error.message || "Не получилось собрать заказ.");
    }
  });

  document.querySelectorAll("[data-member-cart-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const cart = loadCart();
      delete cart[button.dataset.memberCartRemove];
      saveCart(cart);
      await rerenderCurrentSection();
    });
  });

  document.querySelectorAll("[data-member-cart-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.memberCartSave;
      const cart = loadCart();
      delete cart[productId];
      saveCart(cart);
      saveSaved(session, Array.from(new Set([...loadSaved(session), productId])));
      await rerenderCurrentSection();
    });
  });

  document.querySelectorAll("[data-member-saved-move]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.memberSavedMove;
      saveSaved(session, loadSaved(session).filter((item) => item !== productId));
      const cart = loadCart();
      cart[productId] = Number(cart[productId] || 0) + 1;
      saveCart(cart);
      await rerenderCurrentSection();
    });
  });
}

async function sendMemberMessage(payload, status, successText = "Сообщение отправлено.") {
  if (status) status.textContent = "Отправляем...";
  try {
    await createMemberMessage(payload);
    if (status) status.textContent = successText;
    return true;
  } catch (error) {
    if (status) status.textContent = `Не отправилось: ${cleanupError(error.message || "runtime_error")}`;
    return false;
  }
}

async function rerenderCurrentSection() {
  if (currentSession?.ok) {
    renderUserCard(currentSession);
    await renderCabinet(currentSession);
  }
}

async function loadMemberProjectBundle(session) {
  const routeAccess = session.policy?.route_access || {};
  const [catalogItems, specialPages] = await Promise.all([
    routeAccess.catalog ? loadMemberCatalogItems().catch(() => []) : Promise.resolve([]),
    routeAccess.special ? loadMemberSpecialPages().catch(() => []) : Promise.resolve([]),
  ]);
  return { catalogItems, specialPages };
}

async function loadMemberCatalogItems() {
  const response = await fetchJson(`${apiBase()}/member/catalog/items`);
  if (!response.ok) {
    if ([401, 403].includes(response.status)) redirectToLogin();
    throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  }
  return response.data.items || [];
}

async function loadMemberSpecialPages() {
  const response = await fetchJson(`${apiBase()}/member/special-pages`);
  if (!response.ok) {
    if ([401, 403].includes(response.status)) redirectToLogin();
    throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  }
  return response.data.items || [];
}

async function loadMemberCourse() {
  const response = await fetchJson(`${apiBase()}/member/course`);
  if (!response.ok) {
    if ([401, 403].includes(response.status)) redirectToLogin();
    throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  }
  return response.data.item || {};
}

async function loadMemberLesson(lessonId) {
  const response = await fetchJson(`${apiBase()}/member/course/lessons/${encodeURIComponent(lessonId)}`);
  if (!response.ok) throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  return response.data.item || null;
}

async function saveMemberCourseProgress(payload) {
  const response = await fetchJson(`${apiBase()}/member/course/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  return response.data.item || null;
}

async function loadMemberProfile(session) {
  const defaults = {
    display_name: session?.user?.display_name || session?.user?.user_name || "",
    email: session?.user?.email || "",
    phone: session?.user?.phone || "",
    delivery_address: session?.user?.delivery_address || "",
    delivery_comment: session?.user?.delivery_comment || "",
  };
  const response = await fetchJson(`${apiBase()}/member/profile`);
  if (!response.ok) return defaults;
  return { ...defaults, ...(response.data.profile || {}) };
}

async function saveMemberProfile(payload) {
  const response = await fetchJson(`${apiBase()}/member/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  return response.data.profile || {};
}

async function loadMemberOrders() {
  const response = await fetchJson(`${apiBase()}/member/orders`);
  if (!response.ok) return [];
  return Array.isArray(response.data.items) ? response.data.items : [];
}

async function loadMemberOrderDocuments(orderId) {
  const response = await fetchJson(`${apiBase()}/member/orders/${encodeURIComponent(orderId)}/documents`);
  if (!response.ok) return [];
  return Array.isArray(response.data.items) ? response.data.items : [];
}

async function createMemberOrder(payload) {
  const response = await fetchJson(`${apiBase()}/member/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  return response.data.item || null;
}

async function loadMemberMessages() {
  const response = await fetchJson(`${apiBase()}/member/messages`);
  if (!response.ok) throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  return response.data.items || [];
}

async function createMemberMessage(payload) {
  const response = await fetchJson(`${apiBase()}/member/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(cleanupError(response.text || `HTTP ${response.status}`));
  return response.data.item || null;
}

function memberHasScope(session, scope) {
  return new Set(session?.policy?.scopes || session?.user?.scopes || []).has(scope);
}

function loadCart() {
  try {
    return JSON.parse(window.localStorage.getItem(CATALOG_CART_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCart(cart) {
  window.localStorage.setItem(CATALOG_CART_STORAGE_KEY, JSON.stringify(cart || {}));
}

function memberStorageId(session) {
  return String(session?.user?.slug || session?.user?.user_name || session?.user?.email || "member").toLowerCase();
}

function loadSaved(session) {
  try {
    return JSON.parse(window.localStorage.getItem(`${MEMBER_SAVED_STORAGE_KEY}:${memberStorageId(session)}`) || "[]");
  } catch {
    return [];
  }
}

function saveSaved(session, items) {
  window.localStorage.setItem(`${MEMBER_SAVED_STORAGE_KEY}:${memberStorageId(session)}`, JSON.stringify(Array.isArray(items) ? items : []));
}

function buildCartEntries(catalogItems = []) {
  return Object.entries(loadCart())
    .map(([productId, qty]) => {
      const product = normalizeCartProduct(productId, findCatalogCartItem(productId, catalogItems));
      return { product, qty: Number(qty) || 0 };
    })
    .filter((entry) => entry.qty > 0);
}

function buildSavedItems(session, catalogItems = []) {
  return loadSaved(session)
    .map((productId) => normalizeCartProduct(productId, findCatalogCartItem(productId, catalogItems)))
    .filter(Boolean);
}

function findCatalogCartItem(productId, catalogItems = []) {
  const raw = String(productId || "").trim();
  const productSlug = raw.replace(/^prod-/, "");
  const apiSlug = `catalog-product-${productSlug}`;
  return catalogItems.find((item) => {
    const pathSlug = String(item.path || "").split("/").filter(Boolean).at(-1) || "";
    return [item.id, item.slug, item.product_id, pathSlug].map((value) => String(value || "")).some((value) => (
      value === raw || value === productSlug || value === apiSlug
    ));
  }) || null;
}

function normalizeCartProduct(productId, item) {
  if (!item) {
    return { id: productId, title: humanizeCartProductId(productId), summary: "", category: "" };
  }
  return { ...item, id: productId };
}

function humanizeCartProductId(productId) {
  return String(productId || "Позиция")
    .replace(/^prod-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadCalculationNotes(session) {
  try {
    return JSON.parse(window.localStorage.getItem(`${MEMBER_CALC_NOTES_STORAGE_KEY}:${memberStorageId(session)}`) || "[]");
  } catch {
    return [];
  }
}

function saveCalculationNotes(session, notes) {
  window.localStorage.setItem(`${MEMBER_CALC_NOTES_STORAGE_KEY}:${memberStorageId(session)}`, JSON.stringify(Array.isArray(notes) ? notes : []));
}

function loadLatestCalculationSnapshot() {
  const cropIds = ["strawberry", "cucumber"];
  let currentCrop = "strawberry";
  try {
    const storedCrop = window.localStorage.getItem(CALC_CROP_STORAGE_KEY);
    if (cropIds.includes(storedCrop)) currentCrop = storedCrop;
  } catch {
    // ignore storage failures
  }
  const candidates = [currentCrop, ...cropIds.filter((item) => item !== currentCrop)];
  for (const cropId of candidates) {
    const state = readCalculationState(cropId);
    if (state && Object.keys(state).length) return buildCalculationSnapshot(cropId, state);
  }
  return buildCalculationSnapshot(currentCrop, null);
}

function readCalculationState(cropId) {
  try {
    const raw = window.localStorage.getItem(`${CALC_STATE_STORAGE_KEY}.${cropId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildCalculationSnapshot(cropId, state) {
  const cropLabel = cropId === "cucumber" ? "Огурец" : "Клубника";
  if (!state) {
    return { exists: false, cropLabel, sizeLabel: "-", areaLabel: "нет данных", economyLabel: "нет данных", items: [] };
  }
  const width = Number(state.a0 || 0);
  const length = Number(state.a1 || 0);
  const height = Number(state.a2 || 0);
  const powerRate = Number(state.a3 || 0);
  const rentRate = Number(state.a4 || 0);
  const saleRate = Number(state.a5 || 0);
  const area = width > 0 && length > 0 ? width * length : 0;
  const sizeLabel = width && length ? `${formatNumber(width)} × ${formatNumber(length)} м` : "размер не задан";
  const areaLabel = area ? `${formatNumber(area)} м²` : "площадь не задана";
  const economyLabel = [
    powerRate ? `${formatRub(powerRate)}/кВт` : "",
    rentRate ? `${formatRub(rentRate)}/м²` : "",
    saleRate ? `${formatRub(saleRate)}/кг` : "",
  ].filter(Boolean).join(" · ") || "деньги не заданы";
  return {
    exists: true,
    cropLabel,
    sizeLabel,
    areaLabel,
    economyLabel,
    items: [
      { label: "Культура", value: cropLabel },
      { label: "Размер", value: `${sizeLabel}${height ? ` · высота ${formatNumber(height)} м` : ""}` },
      { label: "Площадь", value: areaLabel },
      { label: "Экономика", value: economyLabel },
    ],
  };
}

function buildCalculationManagerMessage(snapshot, note) {
  return [
    "Пометка покупателя к расчёту калькулятора.",
    "",
    `Культура: ${snapshot.cropLabel || "не указана"}`,
    `Размер: ${snapshot.sizeLabel || "не указан"}`,
    `Площадь: ${snapshot.areaLabel || "не указана"}`,
    `Деньги: ${snapshot.economyLabel || "не указаны"}`,
    "",
    "Комментарий:",
    note,
  ].join("\n");
}

function orderLineItems(order) {
  const rawItems = Array.isArray(order?.line_items) ? order.line_items : Array.isArray(order?.items) ? order.items : [];
  return rawItems.map((item) => ({
    ...item,
    qty: item.qty ?? item.quantity,
    summary: item.summary || item.payload?.summary || "",
    category: item.category || item.payload?.category || "",
    path: item.path || item.payload?.path || "",
  }));
}

function renderStatCard(label, value, note) {
  return `<article class="cabinet-stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(note || "")}</em></article>`;
}

function renderInput(label, field, value, type = "text", options = {}) {
  const attrs = options.readonly ? ' readonly aria-readonly="true"' : "";
  return `
    <label class="cabinet-field">
      <span class="cabinet-field-label">${escapeHtml(label)}</span>
      <input class="cabinet-input" data-member-profile="${escapeAttribute(field)}" type="${escapeAttribute(type)}" value="${escapeAttribute(value)}"${attrs} />
    </label>
  `;
}

function renderTextarea(label, field, value, placeholder) {
  return `
    <label class="cabinet-field cabinet-field--wide">
      <span class="cabinet-field-label">${escapeHtml(label)}</span>
      <textarea class="cabinet-textarea" data-member-profile="${escapeAttribute(field)}" placeholder="${escapeAttribute(placeholder)}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function renderDocumentRow(item) {
  const href = resolveOrderDocumentHref(item.file_url);
  return `
    <article class="cabinet-list-row cabinet-list-row--documents">
      <div class="cabinet-list-cell"><strong>${escapeHtml(item.title || "Документ")}</strong><span>${escapeHtml(item.file_size || item.document_type || "")}</span></div>
      <div class="cabinet-list-cell"><strong>${escapeHtml(item.orderTitle || item.order_id || "Заказ")}</strong><span>${escapeHtml(formatDate(item.created_at))}</span></div>
      <div class="cabinet-list-cell"><strong>${escapeHtml(humanizeDocumentStatus(item.status))}</strong><span>${escapeHtml(item.note || "")}</span></div>
      <div class="cabinet-list-cell">${href ? `<strong><a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">Открыть</a></strong>` : "<strong>Готовится</strong>"}</div>
    </article>
  `;
}

function renderMessageItem(item, latestTeamMessageId = null) {
  const isTeam = String(item.sender_type || "").toLowerCase() === "staff";
  const isLatestTeam = latestTeamMessageId && String(item.id) === String(latestTeamMessageId);
  return `
    <article class="cabinet-message ${isTeam ? "is-team" : "is-member"} ${isLatestTeam ? "is-latest" : ""}">
      <div class="cabinet-message__meta">
        <strong>${escapeHtml(isTeam ? "Команда" : "Вы")}</strong>
        <span>${escapeHtml(formatDate(item.created_at))}</span>
      </div>
      ${item.subject ? `<div class="cabinet-message__subject">${escapeHtml(item.subject)}</div>` : ""}
      <p>${escapeHtml(item.message || item.body || item.text || "")}</p>
    </article>
  `;
}

function renderUnavailable(title, message) {
  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Кабинет</div>
        <h2 class="calc-card-title">${escapeHtml(title || "Раздел временно недоступен")}</h2>
        <p class="sublead">${escapeHtml(message || "Попробуйте открыть раздел позже.")}</p>
      </div>
      <div class="cabinet-home-actions">
        <a class="btn btn-primary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать команде</a>
        <a class="btn btn-secondary" href="${escapeAttribute(routes.site)}">Вернуться на сайт</a>
      </div>
    </div>
  `;
}

function readProfileField(field) {
  return document.querySelector(`[data-member-profile="${cssEscape(field)}"]`)?.value.trim() || "";
}

function filterMessagesForOrder(order, messages = []) {
  const id = String(order.id || "");
  const title = String(order.title || "");
  return messages.filter((message) => {
    const probe = `${message.subject || ""} ${message.message || ""} ${message.body || ""}`;
    return (id && probe.includes(id)) || (title && probe.includes(title));
  });
}

function buildOrderMessageSubject(order) {
  return `Заказ ${order.title || order.id || ""}`.trim();
}

function findLatestTeamMessage(messages) {
  return [...(Array.isArray(messages) ? messages : [])]
    .filter((item) => String(item.sender_type || "").toLowerCase() === "staff")
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
}

function profileCompleteness(profile) {
  return [profile.email, profile.phone, profile.delivery_address].filter((value) => String(value || "").trim()).length;
}

function getDisplayName(session) {
  return session?.user?.display_name || session?.user?.user_name || session?.user?.email || "Покупатель";
}

function getCabinetCustomerLabel(session) {
  const displayName = String(session?.user?.display_name || session?.user?.user_name || "").trim();
  if (displayName && !/^admin$/i.test(displayName)) return displayName;
  return "Покупатель";
}

function resolvePublicPath(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("data:")) return raw;
  return routePath(raw);
}

function resolveOrderDocumentHref(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw)) return raw;
  return resolvePublicPath(raw);
}

function humanizeOrderStatus(status) {
  const labels = {
    draft: "Черновик",
    new: "Новый",
    pending: "На проверке",
    confirmed: "Подтверждён",
    paid: "Оплачен",
    shipped: "Отгружен",
    completed: "Завершён",
    cancelled: "Отменён",
  };
  return labels[String(status || "").toLowerCase()] || status || "В работе";
}

function humanizeOrderSource(source) {
  const labels = {
    tilda: "Tilda",
    cabinet: "Кабинет",
    admin: "Админ",
    import: "Импорт",
  };
  return labels[String(source || "").toLowerCase()] || source || "Кабинет";
}

function humanizePaymentStatus(status) {
  const labels = {
    paid: "Оплачено",
    unpaid: "Не оплачено",
    pending: "Оплата проверяется",
    authorized: "Оплата авторизована",
    refunded: "Возврат",
    failed: "Оплата не прошла",
    cancelled: "Оплата отменена",
  };
  return labels[String(status || "").toLowerCase()] || status || "Оплата уточняется";
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "completed", "confirmed", "ready", "sent"].includes(normalized)) return "positive";
  if (["pending", "authorized", "draft", "new"].includes(normalized)) return "pending";
  if (["failed", "cancelled", "canceled", "refunded"].includes(normalized)) return "danger";
  return "neutral";
}

function formatOrderAmount(order) {
  const amount = Number(order?.total_amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const currency = String(order?.currency || "RUB").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ru-RU")} ${currency}`;
  }
}

function humanizeDocumentStatus(status) {
  const labels = {
    draft: "Готовится",
    ready: "Готов",
    sent: "Отправлен",
    archived: "Архив",
  };
  return labels[String(status || "").toLowerCase()] || status || "Готовится";
}

function getCourseLessonStatus(lesson) {
  if (!lesson?.available) return { id: "locked", label: "Закрыт" };
  if (lesson.quiz_stale) return { id: "in_progress", label: "В работе" };
  if (lesson.status === "completed") return { id: "completed", label: "Пройден" };
  if (lesson.status === "homework_approved") return { id: "checked", label: "Домашка принята" };
  if (lesson.status === "homework_submitted") return { id: "in_progress", label: "На проверке" };
  if (lesson.status === "quiz_passed" || lesson.quiz_passed === true || lesson.status === "checked") return { id: "in_progress", label: "Тест сдан" };
  if (lesson.status === "video_watched") return { id: "in_progress", label: "Видео просмотрено" };
  if (lesson.status === "started" || Number(lesson.progress_percent || 0) > 0) return { id: "in_progress", label: "Начат" };
  return { id: "available", label: "Доступен" };
}

function getCourseModuleStatus(module) {
  const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
  if (!lessons.length) return { id: "locked", label: "Закрыт" };
  const statuses = lessons.map((lesson) => getCourseLessonStatus(lesson).id);
  if (statuses.every((status) => status === "completed")) return { id: "completed", label: "Пройден" };
  if (statuses.some((status) => status === "in_progress" || status === "completed")) return { id: "in_progress", label: "В работе" };
  if (statuses.some((status) => status === "checked")) return { id: "checked", label: "Тест сдан" };
  if (statuses.some((status) => status === "available")) return { id: "available", label: "Доступен" };
  return { id: "locked", label: "Закрыт" };
}

function humanizeCourseMaterialType(type) {
  const labels = {
    video: "видео",
    worksheet: "практика",
    transcript: "транскрибация",
    text: "текст",
  };
  return labels[String(type || "").toLowerCase()] || "материал";
}

function humanizeCourseMaterialStatus(status) {
  const labels = {
    ready: "готово",
    snapshot_pending: "готовится",
    tilda_members_shell_only: "готовится",
    locked: "закрыто",
    draft: "черновик",
  };
  return labels[String(status || "").toLowerCase()] || "в работе";
}

function humanizeCourseHomeworkStatus(status) {
  const labels = {
    draft: "Черновик",
    submitted: "Отправлено на проверку",
    needs_revision: "Нужна доработка",
    approved: "Принято",
    archived: "Архив",
  };
  return labels[String(status || "").toLowerCase()] || "Черновик";
}

function humanizeCourseMaterialMeta(item) {
  if (!item?.embed_url && item?.type === "worksheet") return "";
  const parts = [
    humanizeCourseMaterialType(item?.type),
    humanizeCourseMaterialStatus(item?.status),
  ];
  if (item?.duration) parts.push(String(item.duration));
  if (item?.size) parts.push(String(item.size));
  return parts.filter(Boolean).join(" · ");
}

function humanizeCategory(value) {
  const labels = {
    led: "Освещение",
    "linear-led": "Линейный свет",
    "greenhouse-led": "Тепличный свет",
    irrigation: "Полив",
    drippers: "Капельницы",
    fittings: "Фитинги",
    "irrigation-kits": "Наборы полива",
    racks: "Стеллажи",
    "rack-frames": "Каркасы",
    "trays-gutters": "Лотки",
    substrates: "Субстрат",
    "substrate-slabs": "Субстратные маты",
    "propagation-plugs": "Кубики и пробки",
    "planting-material": "Посадочный материал",
    "frigo-plants": "Frigo-рассада",
    "seed-series": "Семена",
    climate: "Климат",
    "air-circulation": "Воздухообмен",
    humidification: "Увлажнение",
    nutrition: "Питание",
    "base-nutrition": "Базовое питание",
    "ph-ec-control": "pH/EC",
    monitoring: "Мониторинг",
    sensors: "Датчики",
    controllers: "Автоматика",
    packaging: "Упаковка",
    "consumer-packaging": "Потребительская упаковка",
  };
  const normalized = String(value || "").trim().toLowerCase();
  return labels[normalized] || String(value || "Позиция").replace(/[_-]+/g, " ");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ? String(value) : "без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(number);
}

function formatRub(value) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value || 0))} ₽`;
}

function pluralizeRu(value, one, few, many) {
  const n = Math.abs(Number(value)) || 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value || "";
  });
}

function setLink(selector, label, href) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = label || "";
    if (href) {
      node.href = href;
      node.hidden = false;
    } else {
      node.hidden = true;
    }
  });
}

function cleanupError(message) {
  const text = String(message || "").replace(/^Error:\s*/u, "").replace(/^["']|["']$/g, "").trim();
  if (!text || /^(HTTP\s+\d+|network_error|runtime_error|not_found|server_error|bad_request)$/i.test(text)) {
    return "Раздел временно недоступен. Попробуйте позже.";
  }
  if (/^(Expected JSON body|kinescope_api_error)/i.test(text)) {
    return "Данные временно не загрузились. Попробуйте позже.";
  }
  return text;
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(String(value || "")) : String(value || "").replace(/"/g, '\\"');
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}
