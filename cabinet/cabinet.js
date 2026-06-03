const SETTINGS_CACHE_KEY = "klubnikaproject.site.backend.settings.v1";
const CANONICAL_SUPPORT_EMAIL = "info@klubnikaproject.ru";
const MEMBER_SESSION_STORAGE_KEY = "klubnikaproject.member.session.v1";
const CATALOG_CART_STORAGE_KEY = "klubnika.catalog.cart.v1";
const MEMBER_SAVED_STORAGE_KEY = "klubnikaproject.cabinet.saved.v1";
const MEMBER_CALC_NOTES_STORAGE_KEY = "klubnikaproject.cabinet.calc-notes.v1";
const CALC_STATE_STORAGE_KEY = "klubnikaproject.calc.state.v4";
const CALC_CROP_STORAGE_KEY = "klubnikaproject.calc.crop.v1";

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
  consultations: routePath("consultations/"),
};

let settings = clone(DEFAULT_SETTINGS);
let currentSession = null;

document.addEventListener("DOMContentLoaded", initCabinet);

async function initCabinet() {
  settings = loadCachedSettings();
  const view = document.body.dataset.cabinetView || "shell";
  const localLoginPreview = view === "login" && isLocalPreview();
  if (!localLoginPreview) {
    await refreshSettings();
  }

  if (view === "login") {
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
  window.location.href = `${routes.login}?next=${encodeURIComponent(next)}`;
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
  content.innerHTML = '<div class="account-empty">Собираем раздел и проверяем живые данные...</div>';

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
    ? (await Promise.all(orders.slice(0, 5).map(async (order) => {
        const items = await loadMemberOrderDocuments(order.id).catch(() => []);
        return items.map((item) => ({ ...item, orderTitle: order.title || `Заказ #${order.id || ""}` }));
      }))).flat()
    : [];

  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Покупка</div>
        <h2 class="calc-card-title">Мои покупки</h2>
        <p class="sublead">Заказы, документы и корзина собраны в одном месте.</p>
      </div>
      <div class="cabinet-home-grid cabinet-home-grid--single">
        <div class="cabinet-home-main">
          ${renderOrdersCard(orders, documents)}
          ${renderCartCard(session, cartEntries)}
          ${renderSavedCard(session, savedItems)}
        </div>
      </div>
    </div>
  `;
}

function renderCartCard(session, entries) {
  return `
    <section class="card card-pad cabinet-card">
      <div class="cabinet-kicker">Корзина</div>
      <h3 class="calc-card-title">Корзина</h3>
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
        <div class="account-empty">Корзина пока пустая. Если закупку нужно собрать вручную, напишите команде.</div>
        <div class="cabinet-home-actions">
          <a class="btn btn-primary" href="${escapeAttribute(routes.catalog)}">Перейти в каталог</a>
          <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать по закупке</a>
          <a class="btn btn-secondary" href="${escapeAttribute(routes.calc)}">Открыть калькулятор</a>
        </div>
      `}
    </section>
  `;
}

function renderOrdersCard(orders, documents) {
  return `
    <section class="card card-pad cabinet-card">
      <div class="cabinet-kicker">Заказы</div>
      <h3 class="calc-card-title">Мои заказы</h3>
      ${orders.length ? `
        <div class="cabinet-list">
          <div class="cabinet-list-head cabinet-list-head--catalog">
            <span>Заказ</span><span>Статус и оплата</span><span>Переход</span>
          </div>
          <div class="cabinet-list-body">
            ${orders.map((order) => {
              const lineItems = orderLineItems(order);
              const amount = formatOrderAmount(order);
              return `
              <article class="cabinet-list-row cabinet-list-row--catalog">
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(order.title || `Заказ #${order.id || ""}`)}</strong>
                  <span>${escapeHtml([formatDate(order.created_at), amount].filter(Boolean).join(" · "))}</span>
                </div>
                <div class="cabinet-list-cell">
                  <strong>${escapeHtml(humanizeOrderStatus(order.status))}</strong>
                  <span>${escapeHtml(humanizePaymentStatus(order.payment_status))}</span>
                </div>
                <div class="cabinet-list-cell">
                  <strong><a href="${escapeAttribute(cabinetSectionHref("purchase", { order: order.id }))}">Открыть заказ</a></strong>
                  <span>${escapeHtml(lineItems.length)} позиций</span>
                </div>
              </article>
            `; }).join("")}
          </div>
        </div>
      ` : '<div class="account-empty">Заказов пока нет. Они появятся после подтверждения закупки.</div>'}
      ${documents.length ? `
        <div class="cabinet-list cabinet-list--documents-window">
          <div class="cabinet-list-head cabinet-list-head--documents">
            <span>Документ</span><span>Заказ</span><span>Статус</span><span>Открыть</span>
          </div>
          <div class="cabinet-list-body">
            ${documents.slice(0, 5).map(renderDocumentRow).join("")}
          </div>
        </div>
      ` : '<div class="cabinet-inline-hint">Документы появятся здесь после подготовки счёта, спецификации или PDF.</div>'}
    </section>
  `;
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
      ${renderProfileCard(profile)}
    </div>
  `;
}

function renderProfileCard(profile) {
  return `
    <section class="card card-pad cabinet-card cabinet-profile-card">
      <div class="cabinet-kicker">Данные</div>
      <h3 class="calc-card-title">Контакты и доставка</h3>
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
  const selectedLessonId = new URLSearchParams(window.location.search).get("lesson");
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);

  if (selectedLesson) {
    const detail = await loadMemberLesson(selectedLesson.id).catch(() => selectedLesson);
    return renderCourseLessonDetail(course, detail);
  }

  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">Курс</div>
        <h2 class="calc-card-title">${escapeHtml(course.title || "Клубничный Хак")}</h2>
        <p class="sublead">${course.has_access ? "Доступ активен. Проходите уроки, сдавайте короткие проверки и фиксируйте свой этап." : "Первый урок открыт как стартовый. Полный курс привязан к покупке и выдаче доступа."}</p>
      </div>
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
        ${renderStatCard("Доступ", course.has_access ? "Активен" : "Нет", course.has_access ? "по базе кабинета" : "нужна покупка или ручная выдача")}
        ${renderStatCard("Уроки", String(lessons.length), `${available} доступно`)}
        ${renderStatCard("Проверки", String(checked), checked ? "есть результаты тестов" : "пока нет")}
        ${renderStatCard("Пройдено", String(completed), completed ? "прогресс сохранён" : "пока нет")}
      </div>
      ${modules.map(renderCourseModule).join("")}
      ${course.has_access ? "" : `
        <section class="card card-pad cabinet-card">
          <div class="cabinet-kicker">Доступ</div>
          <h3 class="calc-card-title">Курс пока закрыт</h3>
          <p class="sublead">Если курс уже оплачен, отправьте сообщение: мы сверим покупку и выдадим доступ в новом кабинете.</p>
          <div class="cabinet-home-actions">
            <a class="btn btn-primary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать по доступу</a>
            <a class="btn btn-secondary" href="${escapeAttribute(routes.site)}klubhack/">Открыть страницу курса</a>
          </div>
        </section>
      `}
    </div>
  `;
}

function renderCourseStage(module) {
  const lessons = Array.isArray(module.lessons) ? module.lessons : [];
  const completed = lessons.filter((lesson) => lesson.status === "completed").length;
  const current = lessons.some((lesson) => lesson.status === "started" || lesson.status === "checked");
  const label = completed === lessons.length && lessons.length ? "готово" : current ? "в работе" : "ожидает";
  return `
    <article class="cabinet-course-stage ${current ? "is-current" : ""} ${completed === lessons.length && lessons.length ? "is-done" : ""}">
      <strong>${escapeHtml(module.title || module.id || "Модуль")}</strong>
      <span>${escapeHtml(label)} · ${escapeHtml(String(completed))}/${escapeHtml(String(lessons.length))}</span>
    </article>
  `;
}

function renderCourseModule(module) {
  const lessons = Array.isArray(module.lessons) ? module.lessons : [];
  const completed = lessons.filter((lesson) => lesson.status === "completed").length;
  return `
    <section class="card card-pad cabinet-card">
      <div class="cabinet-kicker">${escapeHtml(module.id || "Модуль")}</div>
      <h3 class="calc-card-title">${escapeHtml(module.title || "Модуль курса")}</h3>
      <p class="sublead">${escapeHtml(module.summary || `${completed} из ${lessons.length} уроков пройдено.`)}</p>
      <div class="cabinet-list">
        <div class="cabinet-list-body">
          ${lessons.map((lesson) => `
            <article class="cabinet-list-row cabinet-list-row--course">
              <div class="cabinet-list-cell">
                <strong>${escapeHtml(lesson.title || lesson.id)}</strong>
                <span>${escapeHtml(lesson.summary || lesson.legacy_alias || "")}</span>
              </div>
              <div class="cabinet-list-cell">
                <strong>${escapeHtml(humanizeCourseStatus(lesson.status))}</strong>
                <span>${renderCourseLessonMeta(lesson)}</span>
              </div>
              <div class="cabinet-list-cell">
                ${lesson.available
                  ? `<strong><a href="${escapeAttribute(cabinetSectionHref("course", { lesson: lesson.id }))}">Открыть</a></strong>`
                  : "<strong>Закрыт</strong>"}
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderCourseLessonMeta(lesson) {
  const parts = [];
  if (lesson.estimated_minutes) parts.push(`${lesson.estimated_minutes} мин`);
  if (lesson.progress_percent) parts.push(`${lesson.progress_percent}%`);
  if (lesson.quiz_passed === true) parts.push("тест зачтён");
  if (lesson.quiz_passed === false) parts.push("тест не зачтён");
  return escapeHtml(parts.join(" · ") || "без прогресса");
}

function renderCourseLessonDetail(course, lesson) {
  const locked = lesson.locked || !lesson.available;
  const quizPassed = lesson.quiz_passed === true;
  const quizChecked = typeof lesson.quiz_passed === "boolean";
  return `
    <div class="cabinet-section-stack">
      <div class="cabinet-section-intro">
        <div class="cabinet-kicker">${escapeHtml(lesson.module_title || course.title || "Курс")}</div>
        <h2 class="calc-card-title">${escapeHtml(lesson.title || "Урок")}</h2>
        <p class="sublead">${locked ? "Урок закрыт до выдачи доступа." : escapeHtml(lesson.summary || "Пройдите материал, выполните действие и сдайте короткую проверку.")}</p>
      </div>
      <section class="card card-pad cabinet-card">
        <div class="cabinet-kicker">${locked ? "Доступ" : "Урок"}</div>
        <h3 class="calc-card-title">${locked ? "Нет доступа" : "Каркас прохождения"}</h3>
        ${locked ? `
          <p class="sublead">Если курс уже оплачен, напишите команде, чтобы сверить оплату и активировать доступ.</p>
          <div class="cabinet-home-actions">
            <a class="btn btn-primary" href="${escapeAttribute(cabinetSectionHref("messages"))}">Написать по доступу</a>
          </div>
        ` : `
          <div class="cabinet-mini-list cabinet-mini-list--compact">
            <article class="cabinet-mini-card"><strong>Этап</strong><span>${escapeHtml(lesson.stage_title || lesson.stage || "Курс")}</span></article>
            <article class="cabinet-mini-card"><strong>Статус</strong><span>${escapeHtml(humanizeCourseStatus(lesson.status))}</span></article>
            <article class="cabinet-mini-card"><strong>Прогресс</strong><span>${escapeHtml(String(lesson.progress_percent || 0))}%</span></article>
            <article class="cabinet-mini-card"><strong>Проверка</strong><span>${quizChecked ? (quizPassed ? "зачтена" : "нужно повторить") : "не сдана"}</span></article>
          </div>
          <div class="cabinet-course-lesson-grid">
            <article class="cabinet-course-block">
              <div class="cabinet-kicker">Материал</div>
              <h4>Что разобрать</h4>
              ${renderCourseBulletList(lesson.objectives)}
              ${renderCourseMaterials(lesson.materials)}
            </article>
            <article class="cabinet-course-block">
              <div class="cabinet-kicker">Задание</div>
              <h4>Что зафиксировать</h4>
              <p>${escapeHtml(lesson.assignment || "Запишите решение по уроку и следующий шаг.")}</p>
              <div class="cabinet-course-note">Позже сюда можно добавить поле ответа/домашки и проверку менеджером.</div>
            </article>
          </div>
          ${renderCourseQuiz(lesson)}
          <div class="cabinet-user-card-actions">
            <button class="btn btn-secondary" type="button" data-course-progress="${escapeAttribute(lesson.id)}" data-course-status="started">Сохранить как начатый</button>
            <button class="btn btn-primary" type="button" data-course-progress="${escapeAttribute(lesson.id)}" data-course-status="completed">Отметить урок пройденным</button>
            <a class="btn btn-secondary" href="${escapeAttribute(cabinetSectionHref("course"))}">К списку уроков</a>
          </div>
          <div class="cabinet-users-status" data-course-progress-status></div>
        `}
      </section>
    </div>
  `;
}

function renderCourseBulletList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return '<p class="sublead">Материал урока подключается из snapshot.</p>';
  return `<ul class="cabinet-course-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderCourseMaterials(items) {
  const materials = Array.isArray(items) ? items : [];
  if (!materials.length) return "";
  return `
    <div class="cabinet-course-materials">
      ${materials.map((item) => `
        <div class="cabinet-course-material">
          <strong>${escapeHtml(item.title || "Материал")}</strong>
          <span>${escapeHtml(humanizeCourseMaterialType(item.type))} · ${escapeHtml(humanizeCourseMaterialStatus(item.status))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCourseQuiz(lesson) {
  const questions = Array.isArray(lesson.quiz?.questions) ? lesson.quiz.questions : [];
  if (!questions.length) return "";
  return `
    <form class="cabinet-course-quiz" data-course-quiz="${escapeAttribute(lesson.id)}">
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
      <section class="card card-pad cabinet-card cabinet-message-panel">
        <div class="cabinet-kicker">Диалог</div>
        <h3 class="calc-card-title">Чат по проекту</h3>
        <div class="cabinet-message-shell">
          <div class="cabinet-message-window">
            ${timeline.length ? `<div class="cabinet-message-thread">${timeline.map((item) => renderMessageItem(item, latestTeamMessage?.id)).join("")}</div>` : '<div class="cabinet-message-empty"><strong>Сообщений пока нет</strong><span>Напишите вопрос, ответ появится здесь же.</span></div>'}
          </div>
          <div class="cabinet-message-composer">
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
      <div class="cabinet-inline-hint">
        Срочно: ${contactLinks || "напишите сообщение в форме выше"}.
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
        await saveMemberCourseProgress({
          lesson_id: button.dataset.courseProgress,
          status: button.dataset.courseStatus || "started",
          progress_percent: button.dataset.courseStatus === "completed" ? 100 : 10,
        });
        await rerenderCurrentSection();
        const nextStatus = document.querySelector("[data-course-progress-status]");
        if (nextStatus) nextStatus.textContent = "Прогресс сохранён.";
      } catch (error) {
        if (status) status.textContent = `Не сохранилось: ${cleanupError(error.message || "runtime_error")}`;
      }
    });
  });
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

function humanizeCourseStatus(status) {
  const labels = {
    not_started: "Не начат",
    started: "Начат",
    checked: "Проверка сдана",
    completed: "Пройден",
  };
  return labels[String(status || "").toLowerCase()] || status || "Не начат";
}

function humanizeCourseMaterialType(type) {
  const labels = {
    video: "видео",
    worksheet: "практика",
    text: "текст",
  };
  return labels[String(type || "").toLowerCase()] || "материал";
}

function humanizeCourseMaterialStatus(status) {
  const labels = {
    ready: "готово",
    snapshot_pending: "из Tilda snapshot",
    draft: "черновик",
  };
  return labels[String(status || "").toLowerCase()] || "в работе";
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
  return String(message || "").replace(/^Error:\s*/u, "").replace(/^["']|["']$/g, "");
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
