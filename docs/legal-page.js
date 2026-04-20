async function loadLegalFragment() {
  const host = document.querySelector("[data-legal-fragment]");
  if (!host) return;

  const src = host.getAttribute("data-legal-fragment");
  if (!src) return;

  try {
    const response = await fetch(src, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    host.innerHTML = await response.text();
  } catch (error) {
    host.innerHTML = "<p>Не удалось загрузить текст документа.</p>";
    console.error("Failed to load legal fragment", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadLegalFragment, { once: true });
} else {
  loadLegalFragment();
}
