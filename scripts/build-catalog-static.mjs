import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CATALOG_META,
  buildProductJsonLd,
  catalogData,
  createDefaultCategoryDraft,
  getProductPageData,
} from "../catalog/_app/catalog-data.mjs";
import { getRouteMeta, renderCatalogApp } from "../catalog/_app/catalog-renderers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function getRoutePath(route) {
  if (route.type === "landing") return "catalog/index.html";
  if (route.type === "category") return `catalog/${route.categorySlug}/index.html`;
  return `catalog/${route.categorySlug}/${route.productSlug}/index.html`;
}

function getContext(route) {
  if (route.type === "landing") {
    return { route, siteRoot: "../", catalogRoot: "./" };
  }
  if (route.type === "category") {
    return { route, siteRoot: "../../", catalogRoot: "../" };
  }
  return { route, siteRoot: "../../../", catalogRoot: "../../" };
}

function getStaticState(route) {
  if (route.type === "category") {
    const applied = createDefaultCategoryDraft(new URLSearchParams());
    return {
      category: {
        searchParams: new URLSearchParams(),
        applied,
        draft: structuredClone(applied),
        selectedProductIds: [],
      },
    };
  }
  if (route.type === "product") {
    return {
      product: {
        activeTab: "description",
        activeImageIndex: 0,
        reviewSort: "newest",
        reviews: [],
      },
    };
  }
  return {};
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function absoluteUrl(value = "") {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${CATALOG_META.siteOrigin}/${value}`.replace(/([^:]\/)\/+/g, "$1");
}

function replaceTagAttribute(html, selector, attr, value) {
  const escaped = escapeAttribute(value);
  const pattern = new RegExp(`(<${selector}[^>]*\\s${attr}=)"[^"]*"`,"i");
  return html.replace(pattern, `$1"${escaped}"`);
}

function replaceJsonLdByType(html, type, data) {
  const scriptPattern = /<script type="application\/ld\+json">[\s\S]*?<\/script>/g;
  const scripts = html.match(scriptPattern) || [];
  const target = scripts.find((script) => script.includes(`"@type": "${type}"`));
  if (!target) return html;
  return html.replace(target, `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`);
}

function stripTrailingWhitespace(html) {
  return html.replace(/[ \t]+$/gm, "");
}

function updateHeadMetadata(html, route) {
  const meta = getRouteMeta(route);
  let nextHtml = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttribute(meta.title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeAttribute(meta.canonical)}" />`);

  nextHtml = replaceTagAttribute(nextHtml, 'meta name="description"', "content", meta.description);
  nextHtml = replaceTagAttribute(nextHtml, 'meta property="og:title"', "content", meta.title);
  nextHtml = replaceTagAttribute(nextHtml, 'meta property="og:description"', "content", meta.description);
  nextHtml = replaceTagAttribute(nextHtml, 'meta property="og:url"', "content", meta.canonical);
  nextHtml = replaceTagAttribute(nextHtml, 'meta property="og:image"', "content", absoluteUrl(meta.ogImage));

  if (route.type === "product") {
    const data = getProductPageData(route.categorySlug, route.productSlug);
    nextHtml = replaceJsonLdByType(nextHtml, "Product", buildProductJsonLd(data.category, data.product));
  }

  return nextHtml;
}

function getRoutes() {
  return [
    { type: "landing" },
    ...catalogData.categories.map((category) => ({
      type: "category",
      categorySlug: category.slug,
    })),
    ...catalogData.products.map((product) => ({
      type: "product",
      categorySlug: product.categorySlug,
      productSlug: product.slug,
    })),
  ];
}

async function updateCatalogPage(route) {
  const relativePath = getRoutePath(route);
  const filePath = path.join(rootDir, relativePath);
  const html = await fs.readFile(filePath, "utf8");
  const appMarkup = renderCatalogApp(getContext(route), getStaticState(route));
  const appPattern = /<div id="catalog-app">[\s\S]*?\n  <script>\n    window\.__CATALOG_ROUTE__/;
  if (!appPattern.test(html)) {
    throw new Error(`Could not find catalog app markup in ${relativePath}`);
  }
  let nextHtml = html.replace(
    appPattern,
    `<div id="catalog-app">${appMarkup}</div>\n  <script>\n    window.__CATALOG_ROUTE__`
  );

  nextHtml = updateHeadMetadata(nextHtml, route);
  nextHtml = stripTrailingWhitespace(nextHtml);

  await fs.writeFile(filePath, nextHtml);
  return relativePath;
}

const routes = getRoutes();
const updated = [];

for (const route of routes) {
  updated.push(await updateCatalogPage(route));
}

console.log(`Updated ${updated.length} catalog pages`);
