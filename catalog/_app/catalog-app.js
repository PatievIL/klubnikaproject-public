import {
  catalogData,
  createDefaultCategoryDraft,
  getCategoryPageData,
  getProductPageData,
  parseCategorySearchParams,
  replaceCatalogData,
} from "./catalog-data.mjs?v=20260611-footer1";
import { renderCatalogApp } from "./catalog-renderers.mjs?v=20260611-footer1";

const CART_KEY = "klubnika.catalog.cart.v1";
const REVIEW_KEY = "klubnika.catalog.reviews.v1";
const DEFAULT_PUBLIC_API_BASE = "https://api.klubnikaproject.ru/v1";

const appRoot = document.getElementById("catalog-app");
const route = window.__CATALOG_ROUTE__;
const ctx = window.__CATALOG_CONTEXT__;

const volatileStorage = new Map();
let state = buildStateFromLocation();
let catalogMotionInitialized = false;
let liveCatalogStatus = {
  state: "fallback",
  products: 0,
  categories: 0,
};

function resolvePublicApiBase() {
  const configured = window.__KP_CATALOG_API_BASE__ || window.__KP_API_BASE__ || "";
  if (configured) return String(configured).replace(/\/+$/, "");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8010/v1";
  }
  return DEFAULT_PUBLIC_API_BASE;
}

async function hydrateLiveCatalog() {
  try {
    const response = await fetch(`${resolvePublicApiBase()}/public/catalog/snapshot`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const snapshot = payload?.snapshot || payload || {};
    const products = Array.isArray(snapshot.products) ? snapshot.products : [];
    const categories = Array.isArray(snapshot.categories) ? snapshot.categories : [];
    if (!products.length && !categories.length) throw new Error("Empty catalog snapshot");
    replaceCatalogData(
      categories.map((category, index) => normalizeLiveCategory(category, index)),
      products.map((product, index) => normalizeLiveProduct(product, index))
    );
    liveCatalogStatus = {
      state: "live",
      products: products.length,
      categories: categories.length,
      generatedAt: snapshot.generatedAt || snapshot.generated_at || "",
    };
  } catch (error) {
    liveCatalogStatus = {
      state: "fallback",
      products: catalogData.products.length,
      categories: catalogData.categories.length,
      error: error.message,
    };
  }
  window.__CATALOG_LIVE_SNAPSHOT__ = liveCatalogStatus;
  appRoot.dataset.catalogSource = liveCatalogStatus.state;
}

function normalizeLiveCategory(live, index) {
  const seoTitle = live.seoTitle || live.seo_title || live.seo?.title || live.name || live.slug;
  const seoDescription = live.seoDescription || live.seo_description || live.seo?.description || live.description || "";
  return {
    ...live,
    id: live.id || live.slug,
    slug: live.slug,
    parentId: live.parentId || live.parent_id || null,
    parent_id: live.parent_id || live.parentId || null,
    name: live.name || live.title || live.slug,
    description: live.description || "",
    sortOrder: Number.isFinite(Number(live.sortOrder ?? live.sort_order)) ? Number(live.sortOrder ?? live.sort_order) : index + 1,
    status: live.status || "published",
    seoTitle,
    seoDescription,
    seo: {
      title: seoTitle,
      description: seoDescription,
    },
    productCount: Number.isFinite(Number(live.productCount ?? live.product_count))
      ? Number(live.productCount ?? live.product_count)
      : 0,
  };
}

function normalizeLiveProduct(live, index) {
  return {
    ...live,
    id: live.id || live.slug || `live-product-${index + 1}`,
    slug: live.slug,
    categoryId: live.categoryId || live.category_id || live.categorySlug || live.category_slug || "",
    category_id: live.category_id || live.categoryId || live.categorySlug || live.category_slug || "",
    categorySlug: live.categorySlug || live.category_slug || "",
    category_slug: live.category_slug || live.categorySlug || "",
    article: live.article || "",
    name: live.name || live.title || live.slug,
    shortDescription: live.shortDescription || live.short_description || "",
    short_description: live.short_description || live.shortDescription || "",
    fullDescription: live.fullDescription || live.full_description || "",
    full_description: live.full_description || live.fullDescription || "",
    price: normalizeLiveNumber(live.price, 0),
    oldPrice: normalizeLiveNumber(live.oldPrice ?? live.old_price, 0),
    old_price: normalizeLiveNumber(live.old_price ?? live.oldPrice, 0),
    stockStatus: live.stockStatus || live.stock_status || "in_stock",
    stock_status: live.stock_status || live.stockStatus || "in_stock",
    status: live.status || "published",
    seoTitle: live.seoTitle || live.seo_title || live.name || "",
    seoDescription: live.seoDescription || live.seo_description || live.shortDescription || live.short_description || "",
    path: live.path || "",
    images: Array.isArray(live.images) ? live.images : [],
    badges: Array.isArray(live.badges) ? live.badges : [],
    attributes: Array.isArray(live.attributes) ? live.attributes : [],
    documents: Array.isArray(live.documents) ? live.documents : [],
    faq: Array.isArray(live.faq) ? live.faq : [],
    relatedProducts: Array.isArray(live.relatedProducts) ? live.relatedProducts : [],
    rating: normalizeLiveNumber(live.rating, 0),
    reviewCount: normalizeLiveNumber(live.reviewCount ?? live.review_count, 0),
  };
}

function normalizeLiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function loadCart() {
  const fallback = volatileStorage.get(CART_KEY) || "{}";
  try {
    return JSON.parse(window.localStorage?.getItem(CART_KEY) || fallback);
  } catch {
    try {
      return JSON.parse(fallback);
    } catch {
      return {};
    }
  }
}

function saveCart(cart) {
  const serialized = JSON.stringify(cart);
  volatileStorage.set(CART_KEY, serialized);
  try {
    window.localStorage?.setItem(CART_KEY, serialized);
  } catch {
    // Keep the cart usable in browsers or embedded views without localStorage.
  }
}

function loadStoredReviews() {
  const fallback = volatileStorage.get(REVIEW_KEY) || "{}";
  try {
    return JSON.parse(window.localStorage?.getItem(REVIEW_KEY) || fallback);
  } catch {
    try {
      return JSON.parse(fallback);
    } catch {
      return {};
    }
  }
}

function saveStoredReviews(reviews) {
  const serialized = JSON.stringify(reviews);
  volatileStorage.set(REVIEW_KEY, serialized);
  try {
    window.localStorage?.setItem(REVIEW_KEY, serialized);
  } catch {
    // Reviews still work for the current page session when persistent storage is blocked.
  }
}

function getRouteProductData() {
  if (route.type !== "product") return null;
  return getProductPageData(route.categorySlug, route.productSlug);
}

function buildStateFromLocation() {
  const baseState = {
    cart: loadCart(),
    dialogs: {},
    search: {
      query: "",
      mode: "catalog",
    },
    menuCategorySlug: null,
    flashMessage: "",
  };

  if (route.type === "category") {
    const params = new URLSearchParams(window.location.search);
    const applied = parseCategorySearchParams(params);
    return {
      ...baseState,
      category: {
        searchParams: params,
        applied,
        draft: structuredClone(applied),
        selectedProductIds: [],
      },
    };
  }

  if (route.type === "product") {
    const productData = getRouteProductData();
    const storedReviews = loadStoredReviews();
    const userReviews = storedReviews[productData.product.id] || [];
    return {
      ...baseState,
      product: {
        activeTab: normalizeTab(window.location.hash.replace("#", "")),
        activeImageIndex: 0,
        reviewSort: "newest",
        reviews: [...productData.reviews, ...userReviews],
      },
    };
  }

  return baseState;
}

function normalizeTab(value) {
  return ["reviews", "description", "additional"].includes(value) ? value : "description";
}

function syncBodyState() {
  const open = Object.values(state.dialogs || {}).some((value) => Boolean(value));
  document.body.classList.toggle("catalog-ui-locked", open);
}

function render() {
  appRoot.innerHTML = renderCatalogApp(ctx, state);
  syncBodyState();
  if (!catalogMotionInitialized) {
    window.requestAnimationFrame(setupCatalogMotion);
  }
}

function setupCatalogMotion() {
  if (catalogMotionInitialized) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    catalogMotionInitialized = true;
    return;
  }

  const selectors = [
    ".catalog-page-head .catalog-breadcrumbs",
    ".catalog-page-head__titleblock > *",
    ".catalog-page-head__copy > *",
    ".catalog-page-head__toolbar > *",
    ".catalog-product-storehead > *",
    ".catalog-landing-hero__copy > *",
    ".catalog-landing-hero__route",
    ".catalog-landing-node-card",
    ".catalog-category-card",
    ".catalog-product-card",
    ".catalog-decision-card",
    ".catalog-product-gallery",
    ".catalog-product-buybox",
    ".catalog-product-brief > *",
    ".catalog-product-section",
    ".catalog-how-buy-card",
    ".catalog-contact-card",
  ];

  const items = [...new Set(selectors.flatMap((selector) => [...appRoot.querySelectorAll(selector)]))]
    .filter((item) => !item.closest("[hidden], .catalog-overlay"))
    .filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width || rect.height;
    });

  if (!items.length) return;

  catalogMotionInitialized = true;
  document.body.classList.add("catalog-motion-ready");

  items.forEach((item, index) => {
    item.classList.add("catalog-motion-item");
    item.style.setProperty("--catalog-motion-delay", `${Math.min(index * 28, 220)}ms`);

    if (item.matches(".catalog-category-card, .catalog-product-card, .catalog-decision-card, .catalog-product-buybox, .catalog-product-section, .catalog-how-buy-card, .catalog-contact-card, .catalog-landing-node-card")) {
      item.classList.add("catalog-motion-card");
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        window.setTimeout(() => {
          entry.target.classList.remove("catalog-motion-item", "catalog-motion-card", "is-visible");
          entry.target.style.removeProperty("--catalog-motion-delay");
        }, 560);
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.08,
    }
  );

  items.forEach((item) => observer.observe(item));
}

function closeAllDialogs() {
  state.dialogs = {
    search: false,
    cart: false,
    assistant: false,
    menu: false,
    filters: false,
    account: false,
    quickViewProductId: null,
    priceTiersProductId: null,
  };
}

function setDialog(dialog, value) {
  closeAllDialogs();
  if (dialog === "quickViewProductId" || dialog === "priceTiersProductId") {
    state.dialogs[dialog] = value;
  } else {
    state.dialogs[dialog] = value;
  }
  render();
}

function updateCart(productId, delta = 1) {
  const current = state.cart[productId] || 0;
  const next = current + delta;
  if (next <= 0) {
    delete state.cart[productId];
  } else {
    state.cart[productId] = next;
  }
  saveCart(state.cart);
}

function addToCart(productId) {
  if (state.cart[productId]) {
    setDialog("cart", true);
    return;
  }
  updateCart(productId, 1);
  state.flashMessage = "Позиция добавлена в корзину";
  state.dialogs = { ...state.dialogs, cart: true };
  render();
}

function clearFlashSoon() {
  if (!state.flashMessage) return;
  window.setTimeout(() => {
    state.flashMessage = "";
    render();
  }, 1500);
}

function pushCategoryState() {
  const params = new URLSearchParams();
  const applied = state.category.applied;
  if (applied.sort !== "popularity-desc") params.set("sort", applied.sort);
  if (applied.display !== "grid") params.set("display", applied.display);
  if (applied.page !== 1) params.set("page", String(applied.page));
  if (applied.priceMin !== null || applied.priceMax !== null) {
    params.set("price", `${applied.priceMin ?? ""}-${applied.priceMax ?? ""}`);
  }
  if (applied.stockStatuses.length) params.set("stock", applied.stockStatuses.join(","));
  if (applied.badges.length) params.set("badges", applied.badges.join(","));
  Object.entries(applied.attributes).forEach(([key, values]) => {
    if (values.length) params.set(`f_${key}`, values.join(","));
  });
  const query = params.toString();
  const href = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.pushState({}, "", href);
  state.category.searchParams = new URLSearchParams(params);
}

function rerenderCategoryWithUrl() {
  const params = new URLSearchParams(window.location.search);
  const applied = parseCategorySearchParams(params);
  state.category = {
    ...state.category,
    searchParams: params,
    applied,
    draft: structuredClone(applied),
    selectedProductIds: [],
  };
  render();
}

function toggleDraftValue(kind, value, key) {
  const draft = state.category.draft;
  if (kind === "stock") {
    draft.stockStatuses = toggleListValue(draft.stockStatuses, value);
  }
  if (kind === "badge") {
    draft.badges = toggleListValue(draft.badges, value);
  }
  if (kind === "attribute") {
    draft.attributes[key] = toggleListValue(draft.attributes[key] || [], value);
  }
  render();
}

function toggleListValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function selectAllVisible(checked) {
  const data = getCategoryPageData(route.categorySlug, state.category.searchParams);
  state.category.selectedProductIds = checked ? data.pageItems.map((item) => item.id) : [];
  render();
}

function toggleSelectedProduct(productId, checked) {
  const current = new Set(state.category.selectedProductIds);
  if (checked) current.add(productId);
  if (!checked) current.delete(productId);
  state.category.selectedProductIds = Array.from(current);
  render();
}

function submitReview(form) {
  const productData = getRouteProductData();
  const stored = loadStoredReviews();
  const productReviews = stored[productData.product.id] || [];
  const payload = {
    id: `user-${Date.now()}`,
    productId: productData.product.id,
    author: form.get("author"),
    rating: Number(form.get("rating")),
    pros: form.get("pros"),
    cons: form.get("cons"),
    comment: form.get("comment"),
    createdAt: new Date().toISOString().slice(0, 10),
    verified: false,
    helpful: 0,
    media: [],
  };
  stored[productData.product.id] = [payload, ...productReviews];
  saveStoredReviews(stored);
  state.product.reviews = [payload, ...state.product.reviews];
  state.product.activeTab = "reviews";
  state.flashMessage = "Отзыв добавлен";
  render();
  clearFlashSoon();
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-search") {
    setDialog("search", true);
    return;
  }
  if (action === "open-cart") {
    setDialog("cart", true);
    return;
  }
  if (action === "open-menu") {
    state.menuCategorySlug = null;
    setDialog("menu", true);
    return;
  }
  if (action === "open-account") {
    window.location.href = "/cabinet/";
    return;
  }
  if (action === "open-assistant") {
    setDialog("assistant", true);
    return;
  }
  if (action === "open-filters") {
    setDialog("filters", true);
    return;
  }
  if (action === "close-filters") {
    state.dialogs.filters = false;
    render();
    return;
  }
  if (action === "close-dialog") {
    closeAllDialogs();
    render();
    return;
  }
  if (action === "open-quick-view") {
    setDialog("quickViewProductId", target.dataset.productId);
    return;
  }
  if (action === "close-quick-view") {
    state.dialogs.quickViewProductId = null;
    render();
    return;
  }
  if (action === "open-price-tiers") {
    setDialog("priceTiersProductId", target.dataset.productId);
    return;
  }
  if (action === "close-price-tiers") {
    state.dialogs.priceTiersProductId = null;
    render();
    return;
  }
  if (action === "toggle-cart") {
    addToCart(target.dataset.productId);
    clearFlashSoon();
    return;
  }
  if (action === "remove-from-cart") {
    delete state.cart[target.dataset.productId];
    saveCart(state.cart);
    render();
    return;
  }
  if (action === "change-qty") {
    updateCart(target.dataset.productId, Number(target.dataset.delta || "0"));
    render();
    return;
  }
  if (action === "set-display" && route.type === "category") {
    state.category.applied.display = target.dataset.value;
    state.category.draft.display = target.dataset.value;
    state.category.applied.page = 1;
    pushCategoryState();
    render();
    return;
  }
  if (action === "reset-filters" && route.type === "category") {
    const reset = createDefaultCategoryDraft(new URLSearchParams());
    reset.sort = state.category.applied.sort;
    reset.display = state.category.applied.display;
    state.category.draft = structuredClone(reset);
    state.category.applied = structuredClone(reset);
    pushCategoryState();
    render();
    return;
  }
  if (action === "apply-filters" && route.type === "category") {
    state.category.applied = structuredClone(state.category.draft);
    state.category.applied.page = 1;
    state.category.selectedProductIds = [];
    pushCategoryState();
    closeAllDialogs();
    render();
    return;
  }
  if (action === "toggle-selection" && route.type === "category") {
    toggleSelectedProduct(target.dataset.productId, target.checked);
    return;
  }
  if (action === "select-all-visible" && route.type === "category") {
    selectAllVisible(target.checked);
    return;
  }
  if (action === "bulk-add-to-cart" && route.type === "category") {
    state.category.selectedProductIds.forEach((productId) => updateCart(productId, state.cart[productId] ? 0 : 1));
    saveCart(state.cart);
    state.flashMessage = "Выбранные позиции добавлены в корзину";
    render();
    clearFlashSoon();
    return;
  }
  if (action === "set-tab" && route.type === "product") {
    state.product.activeTab = target.dataset.tab;
    window.history.replaceState({}, "", `${window.location.pathname}#${target.dataset.tab}`);
    render();
    return;
  }
  if (action === "set-image" && route.type === "product") {
    state.product.activeImageIndex = Number(target.dataset.index || "0");
    render();
    return;
  }
  if (action === "set-search-mode") {
    state.search.mode = target.dataset.value;
    render();
    return;
  }
  if (action === "open-menu-category") {
    state.menuCategorySlug = target.dataset.categorySlug;
    render();
    return;
  }
  if (action === "back-menu-category") {
    state.menuCategorySlug = null;
    render();
    return;
  }
}

function handleInput(event) {
  const target = event.target;
  if (target.matches('[data-action="search-input"]')) {
    state.search.query = target.value;
    render();
    return;
  }

  if (route.type !== "category") return;

  if (target.matches('[data-filter-kind="price-min"]')) {
    state.category.draft.priceMin = target.value ? Number(target.value) : null;
    render();
    return;
  }
  if (target.matches('[data-filter-kind="price-max"]')) {
    state.category.draft.priceMax = target.value ? Number(target.value) : null;
    render();
    return;
  }
}

function handleChange(event) {
  const target = event.target;

  if (target.matches('[data-action="set-sort"]') && route.type === "category") {
    state.category.applied.sort = target.value;
    state.category.draft.sort = target.value;
    state.category.applied.page = 1;
    pushCategoryState();
    render();
    return;
  }

  if (target.matches('[data-action="set-review-sort"]') && route.type === "product") {
    state.product.reviewSort = target.value;
    render();
    return;
  }

  if (route.type === "category" && target.matches('[data-filter-kind="stock"]')) {
    toggleDraftValue("stock", target.value);
    return;
  }

  if (route.type === "category" && target.matches('[data-filter-kind="badge"]')) {
    toggleDraftValue("badge", target.value);
    return;
  }

  if (route.type === "category" && target.matches('[data-filter-kind="attribute"]')) {
    toggleDraftValue("attribute", target.value, target.dataset.filterKey);
  }
}

function handleSubmit(event) {
  const form = event.target;
  if (form.matches("[data-header-search]")) {
    event.preventDefault();
    const input = form.querySelector('input[type="search"]');
    state.search.query = input.value.trim();
    setDialog("search", true);
    return;
  }

  if (form.matches("[data-review-form]") && route.type === "product") {
    event.preventDefault();
    submitReview(new FormData(form));
  }
}

window.addEventListener("popstate", () => {
  state = buildStateFromLocation();
  render();
});

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);

hydrateLiveCatalog().finally(() => {
  state = buildStateFromLocation();
  render();
});
