function resolveTargetSection() {
  const fromDataset = String(document.body?.dataset?.targetSection || "").trim();
  if (fromDataset) return normalizeTargetSection(fromDataset);
  const fromPath = window.location.pathname.split("/").filter(Boolean).pop() || "";
  return normalizeTargetSection(fromPath || "purchase");
}

function normalizeTargetSection(section) {
  const aliases = {
    overview: "purchase",
    catalog: "purchase",
    cart: "purchase",
    orders: "purchase",
    documents: "purchase",
    profile: "purchase",
    requests: "calculations",
    special: "calculations",
    course: "calculations",
  };
  return aliases[section] || section || "purchase";
}

function buildCabinetHref(section) {
  const params = new URLSearchParams(window.location.search);
  params.set("section", section);
  const match = window.location.pathname.match(/^\/(klubnikaproject-(?:next|public))\//);
  const basePath = match ? `/${match[1]}/` : "/";
  return `${basePath}cabinet/?${params.toString()}`;
}

function redirectToCabinetSection() {
  const section = resolveTargetSection();
  const target = buildCabinetHref(section);
  window.location.replace(target);
}

document.addEventListener("DOMContentLoaded", redirectToCabinetSection);
