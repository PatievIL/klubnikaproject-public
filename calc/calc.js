import {
  CONTROL_CONFIG,
  calculateFarm,
  createDefaultState,
  formatRub,
  formatSmart,
  normalizeInputValue
} from "./calc-core.js?v=20260414a";

const STORAGE_KEY = "klubnikaproject.calc.state.v4";
const CROP_STORAGE_KEY = "klubnikaproject.calc.crop.v1";
const BUILD_ID = "calc-20260405ay";
const AUTH_API_BASE_DEFAULT = "https://api.klubnikaproject.ru/site/v1";
const ADMIN_SESSION_STORAGE_KEY = "klubnikaproject.admin.session.v1";
const MEMBER_SESSION_STORAGE_KEY = "klubnikaproject.member.session.v1";
const API_OVERRIDE_STORAGE_KEY = "klubnikaproject.runtime.api.v1";

const OPTION_UI_LABELS = {
  "water-prep": "Вода и осмос",
  fertilizers: "Удобрения",
  automation: "Автоматика",
  "mixing-inventory": "Инвентарь",
  electrical: "Электрика",
  "climate-pack": "Климат",
  "project-support-month": "Проект",
  "project-support": "Проект",
  seedlings: "Рассада"
};

const GOAL_COPY = {
  entry: {
    title: "Уже видно, где начинается рабочий вход в проект",
    meaning: "Ориентир по порогу входа без лишних опций.",
    next: "Если рамка подходит, следующий шаг — проверка объекта."
  },
  object: {
    title: "Уже видно, что этот размер может дать по сборке",
    meaning: "Можно быстро понять, стоит ли работать с этим помещением.",
    next: "Если помещение реальное, переходим к разбору объекта."
  },
  kit: {
    title: "Уже видно, из чего складывается базовая сборка",
    meaning: "Ориентир по составу для предметного обсуждения.",
    next: "Если состав подходит, уточняем ограничения объекта."
  }
};

const UI_DEFAULTS = {
  goalType: "entry",
  roomMode: "have-room",
  presetSize: "4x8",
  phaseMode: "three-phase",
  cableLayoutMode: "tray"
};

const CROP_CONFIG = {
  strawberry: {
    pricingFile: "./pricing.json"
  },
  cucumber: {
    pricingFile: "./pricing-cucumber.json"
  }
};

let pricing = null;
let state = null;
let currentCrop = loadCurrentCrop();
const acceptedFields = new Set();
let totalDisplayValue = null;
let totalDisplayAnimationFrame = null;
let totalFlashTimeout = null;
let summaryUnlocked = false;
let latestCalculation = null;

const elements = {
  cropSelectorGrid: document.getElementById("crop-selector-grid"),
  goalChoiceGrid: document.getElementById("goal-choice-grid"),
  roomModeGrid: document.getElementById("room-mode-grid"),
  presetGrid: document.getElementById("preset-grid"),
  phaseModeGrid: document.getElementById("phase-mode-grid"),
  cableLayoutGrid: document.getElementById("cable-layout-grid"),
  roomPanels: Array.from(document.querySelectorAll("[data-room-panel]")),
  electricalStep: document.getElementById("electrical-step"),
  featureGrid: document.getElementById("feature-grid"),
  microResultTitle: document.getElementById("micro-result-title"),
  microResultValue: document.getElementById("micro-result-value"),
  microResultText: document.getElementById("micro-result-text"),
  microResultPills: document.getElementById("micro-result-pills"),
  microResultElectricity: document.getElementById("micro-result-electricity"),
  microResultWater: document.getElementById("micro-result-water"),
  microResultRent: document.getElementById("micro-result-rent"),
  microResultOperating: document.getElementById("micro-result-operating"),
  microResultPowerProfile: document.getElementById("micro-result-power-profile"),
  calcEntryStatus: document.getElementById("calc-entry-status"),
  microNextStep: document.getElementById("micro-next-step"),
  summaryProgressCount: document.getElementById("summary-progress-count"),
  summaryProgressText: document.getElementById("summary-progress-text"),
  totalEquipmentCost: document.getElementById("total-equipment-cost"),
  summaryMeaningNote: document.getElementById("summary-meaning-note"),
  summaryGrid: document.getElementById("summary-grid"),
  summaryBreakdown: document.getElementById("summary-breakdown"),
  summaryRevealShell: document.getElementById("summary-reveal-shell"),
  summaryLoginLink: document.getElementById("summary-login-link"),
  calcDetailsRevealShell: document.getElementById("calc-details-reveal-shell"),
  calcDetailsLoginLink: document.getElementById("calc-details-login-link"),
  downloadCalculationButton: document.getElementById("download-calculation-button"),
  briefChipList: document.getElementById("brief-chip-list"),
  nextStepTitle: document.getElementById("next-step-title"),
  nextStepText: document.getElementById("next-step-text"),
  summaryInterpretationTitle: document.getElementById("summary-interpretation-title"),
  summaryInterpretationText: document.getElementById("summary-interpretation-text"),
  equipmentWithoutSeedlings: document.getElementById("equipment-without-seedlings"),
  seedlingsTotalCost: document.getElementById("seedlings-total-cost"),
  assemblyIncludesList: document.getElementById("assembly-includes-list"),
  budgetStructureGrid: document.getElementById("budget-structure-grid"),
  economyCapex: document.getElementById("economy-capex"),
  economyOpexTotal: document.getElementById("economy-opex-total"),
  economyOpexEnergy: document.getElementById("economy-opex-energy"),
  economyOpexWater: document.getElementById("economy-opex-water"),
  economyOpexRent: document.getElementById("economy-opex-rent"),
  economyBerryKg: document.getElementById("economy-berry-kg"),
  economyRevenueMonthReal: document.getElementById("economy-revenue-month-real"),
  economyRevenueYearReal: document.getElementById("economy-revenue-year-real"),
  economyNetMonthReal: document.getElementById("economy-net-month-real"),
  economyPaybackReal: document.getElementById("economy-payback-real"),
  economyScenariosGrid: document.getElementById("economy-scenarios-grid"),
  detailNotes: document.getElementById("detail-notes"),
  electricalSummaryGrid: document.getElementById("electrical-summary-grid"),
  electricalKitGrid: document.getElementById("electrical-kit-grid"),
  electricalScheme: document.getElementById("electrical-scheme"),
  electricalLines: document.getElementById("electrical-lines"),
  dimensionHelperTitle: document.getElementById("dimension-helper-title"),
  dimensionHelperText: document.getElementById("dimension-helper-text"),
  resetDefaultsButton: document.getElementById("reset-defaults-button"),
  roomQuickPresets: Array.from(document.querySelectorAll("[data-quick-preset]")),
  debugBuildId: document.getElementById("debug-build-id"),
  debugAppPhase: document.getElementById("debug-app-phase"),
  debugTotal: document.getElementById("debug-total"),
  debugGoal: document.getElementById("debug-goal"),
  debugRoom: document.getElementById("debug-room"),
  debugSize: document.getElementById("debug-size"),
  debugAppError: document.getElementById("debug-app-error"),
  debugGlobalError: document.getElementById("debug-global-error"),
  methodDialog: document.getElementById("calc-method-dialog"),
  methodDialogOpen: document.querySelector("[data-method-dialog-open]"),
  methodDialogClose: document.querySelector("[data-method-dialog-close]")
};

setDebugAppPhase("module");
window.addEventListener("error", (event) => {
  setDebugGlobalError(event.error?.message || event.message || "window error");
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || String(event.reason || "unhandled rejection");
  setDebugGlobalError(reason);
});

init().catch((error) => {
  console.error(error);
  setDebugAppError(error?.message || String(error));
  setDebugAppPhase("init-error");
});

async function init() {
  setDebugAppPhase("init");
  setDebugAppError("-");
  setDebugGlobalError("-");
  setDebugAppPhase("load-pricing");
  pricing = await loadPricing(currentCrop);
  setDebugAppPhase("build-state");
  state = buildInitialState();
  setDebugAppPhase("public-access");
  summaryUnlocked = true;
  setDebugAppPhase("render-presets");
  renderPresetCards();
  renderFeatureToggles();
  renderCropSelector();
  syncSummaryLoginLink();
  setDebugAppPhase("bind-events");
  bindEvents();
  setDebugAppPhase("first-render");
  render();
  setDebugAppPhase("ready");
}

async function loadPricing(cropId = currentCrop) {
  const config = CROP_CONFIG[cropId] || CROP_CONFIG.strawberry;
  const response = await fetch(config.pricingFile, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${config.pricingFile} not loaded: ${response.status}`);
  }

  return response.json();
}

function loadCurrentCrop() {
  try {
    const raw = window.localStorage.getItem(CROP_STORAGE_KEY);
    return Object.prototype.hasOwnProperty.call(CROP_CONFIG, raw) ? raw : "strawberry";
  } catch {
    return "strawberry";
  }
}

function getStateStorageKey() {
  return `${STORAGE_KEY}.${currentCrop}`;
}

function buildInitialState() {
  const stored = loadStoredState();
  const base = {
    ...UI_DEFAULTS,
    ...createDefaultState(pricing),
    ...stored
  };

  CONTROL_CONFIG.forEach((control) => {
    base[control.key] = normalizeInputValue(base[control.key], control);
  });

  if (!pricing.presets.some((preset) => preset.id === base.presetSize)) {
    base.presetSize = UI_DEFAULTS.presetSize;
  }

  base.roomMode = "have-room";
  syncPresetIntoState(base);
  return base;
}

function loadStoredState() {
  try {
    const raw = window.localStorage.getItem(getStateStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState() {
  window.localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
}

function renderCropSelector() {
  if (!elements.cropSelectorGrid) {
    return;
  }

  elements.cropSelectorGrid.querySelectorAll("[data-crop-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.cropChoice === currentCrop);
  });
}

function renderPresetCards() {
  if (!elements.presetGrid) {
    return;
  }

  elements.presetGrid.innerHTML = pricing.presets.map((preset) => `
    <button class="scenario-card preset-card" type="button" data-choice-key="presetSize" data-choice-value="${preset.id}">
      ${preset.discountPercent ? `<i class="preset-discount-badge">−${preset.discountPercent}%</i>` : ""}
      <strong>${preset.label}</strong>
      <span>${preset.note}</span>
    </button>
  `).join("");
}

function renderFeatureToggles() {
  if (!elements.featureGrid) {
    return;
  }

  elements.featureGrid.innerHTML = (pricing.optionGroups || []).map((group) => `
    <label class="feature-toggle">
      <input type="checkbox" data-toggle-key="${group.stateKey}" />
      <span>
        <strong>${OPTION_UI_LABELS[group.id] || group.label}</strong>
        <small data-option-note="${group.id}">${formatOptionPrice(group)}</small>
      </span>
    </label>
  `).join("");
}

function bindEvents() {
  elements.cropSelectorGrid?.querySelectorAll("[data-crop-choice]").forEach((button) => {
    button.addEventListener("click", handleCropChoiceClick);
  });

  document.querySelectorAll("[data-choice-key]").forEach((button) => {
    button.addEventListener("click", handleChoiceClick);
  });

  document.querySelectorAll("[data-input-type='number'][data-key]").forEach((input) => {
    input.addEventListener("input", handleNumericInput);
    input.addEventListener("change", handleNumericAccept);
    input.addEventListener("blur", handleNumericAccept);
    input.addEventListener("keydown", handleNumericKeydown);
  });

  document.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", handleToggleChange);
  });

  document.querySelectorAll("[data-step-control]").forEach((button) => {
    button.addEventListener("click", handleStepControlClick);
  });

  if (elements.resetDefaultsButton) {
    elements.resetDefaultsButton.addEventListener("click", handleResetDefaultsClick);
  }

  if (elements.downloadCalculationButton) {
    elements.downloadCalculationButton.addEventListener("click", handleDownloadCalculationClick);
  }

  elements.roomQuickPresets.forEach((button) => {
    button.addEventListener("click", handleQuickPresetClick);
  });

  elements.methodDialogOpen?.addEventListener("click", handleMethodDialogOpen);
  elements.methodDialogClose?.addEventListener("click", handleMethodDialogClose);
  elements.methodDialog?.addEventListener("click", handleMethodDialogBackdropClick);
}

function bindDynamicRenderedEvents() {
  elements.presetGrid?.querySelectorAll("[data-choice-key]").forEach((button) => {
    button.addEventListener("click", handleChoiceClick);
  });

  elements.featureGrid?.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", handleToggleChange);
  });
}

function handleMethodDialogOpen() {
  if (!elements.methodDialog) {
    return;
  }

  if (typeof elements.methodDialog.showModal === "function") {
    elements.methodDialog.showModal();
    return;
  }

  elements.methodDialog.setAttribute("open", "");
}

function handleMethodDialogClose() {
  if (!elements.methodDialog) {
    return;
  }

  if (typeof elements.methodDialog.close === "function") {
    elements.methodDialog.close();
    return;
  }

  elements.methodDialog.removeAttribute("open");
}

function handleMethodDialogBackdropClick(event) {
  if (event.target === elements.methodDialog) {
    handleMethodDialogClose();
  }
}

async function handleCropChoiceClick(event) {
  const cropId = event.currentTarget.dataset.cropChoice;
  if (!Object.prototype.hasOwnProperty.call(CROP_CONFIG, cropId) || cropId === currentCrop) {
    return;
  }

  currentCrop = cropId;
  window.localStorage.setItem(CROP_STORAGE_KEY, currentCrop);
  setDebugAppPhase("switch-crop");
  pricing = await loadPricing(currentCrop);
  state = buildInitialState();
  acceptedFields.clear();
  renderPresetCards();
  renderFeatureToggles();
  renderCropSelector();
  bindDynamicRenderedEvents();
  render();
  setDebugAppPhase("ready");
}

function handleChoiceClick(event) {
  const button = event.currentTarget.closest("[data-choice-key]") || event.target.closest("[data-choice-key]");
  if (!button) {
    return;
  }

  const { choiceKey, choiceValue } = button.dataset;
  state[choiceKey] = choiceValue;

  if (choiceKey === "presetSize") {
    syncPresetIntoState(state);
  }

  if (choiceKey === "roomMode" && choiceValue === "need-room") {
    syncPresetIntoState(state);
  }

  render();
}

function handleNumericInput(event) {
  const input = event.currentTarget;
  const control = CONTROL_CONFIG.find((item) => item.key === input.dataset.key);
  if (!control) {
    return;
  }

  const draftValue = parseNumericDraft(input.value);
  if (!Number.isFinite(draftValue)) {
    return;
  }

  state[control.key] = clampNumericValue(draftValue, control);
  acceptedFields.add(control.key);
  render();
}

function handleNumericAccept(event) {
  const input = event.currentTarget;
  const control = CONTROL_CONFIG.find((item) => item.key === input.dataset.key);
  if (!control) {
    return;
  }

  state[control.key] = normalizeInputValue(input.value, control);
  input.value = formatInputValue(state[control.key]);
  acceptedFields.add(control.key);
  render();
}

function handleNumericKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.currentTarget.blur();
}

function handleToggleChange(event) {
  const key = event.currentTarget.dataset.toggleKey;
  state[key] = event.currentTarget.checked;
  render();
}

function handleStepControlClick(event) {
  const button = event.currentTarget;
  const key = button.dataset.stepControl;
  const direction = Number(button.dataset.stepDirection || 0);
  if (!key || !direction) {
    return;
  }

  const control = CONTROL_CONFIG.find((item) => item.key === key);
  if (!control) {
    return;
  }

  const step = Number(control.step || 1);
  const currentValue = normalizeInputValue(state[key], control);
  const nextValue = normalizeInputValue(currentValue + direction * step, control);
  state[key] = nextValue;
  acceptedFields.add(key);

  const input = document.querySelector(`[data-input-type='number'][data-key='${key}']`);
  if (input) {
    input.value = formatInputValue(nextValue);
  }

  render();
}

function handleResetDefaultsClick() {
  const defaults = createDefaultState(pricing);

  CONTROL_CONFIG.forEach((control) => {
    state[control.key] = defaults[control.key];
    acceptedFields.add(control.key);
  });

  if (state.roomMode === "need-room") {
    state.presetSize = UI_DEFAULTS.presetSize;
    syncPresetIntoState(state);
  }

  render();
}

function handleQuickPresetClick(event) {
  const button = event.currentTarget;
  const presetId = button.dataset.quickPreset;
  if (!presetId) {
    return;
  }

  state.presetSize = presetId;
  applyPresetSize(state, presetId);
  acceptedFields.add("a0");
  acceptedFields.add("a1");
  render();
}

function syncPresetIntoState(targetState) {
  if (targetState.roomMode !== "need-room") {
    return;
  }

  applyPresetSize(targetState, targetState.presetSize);
}

function applyPresetSize(targetState, presetId) {
  const preset = pricing.presets.find((entry) => entry.id === presetId) || pricing.presets[0];
  targetState.a0 = normalizeInputValue(preset.width, CONTROL_CONFIG[0]);
  targetState.a1 = normalizeInputValue(preset.length, CONTROL_CONFIG[1]);
}

function render() {
  saveState();

  const calc = calculateFarm(state, pricing);
  latestCalculation = calc;
  renderCropSpecificText(calc);
  renderChoiceStates();
  renderPanels();
  renderConditionalSteps();
  renderInputs();
  renderAcceptedFields();
  renderFeatureToggleNotes(calc);
  renderDimensionHelper(calc);
  renderMicroResult(calc);
  renderSummary(calc);
  renderSummaryReveal();
  renderDetails(calc);
  renderDebug(calc);
}

function handleDownloadCalculationClick() {
  const calc = latestCalculation || calculateFarm(state, pricing);
  downloadCalculationReport(calc);
}

function downloadCalculationReport(calc) {
  const filename = `klubnika-project-raschet-${new Date().toISOString().slice(0, 10)}.html`;
  const html = buildCalculationReportHtml(calc);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildCalculationReportHtml(calc) {
  const cropCopy = getCropCopy(calc);
  const economy = resolveEconomyReport(calc);
  const generatedAt = new Date().toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const inputRows = [
    { label: "Размер", value: `${formatSmart(calc.width)} × ${formatSmart(calc.length)} × ${formatSmart(calc.height)} м` },
    { label: "Площадь фермы", value: `${formatSmart(calc.width * calc.length)} м²` },
    { label: "Конфигурация", value: formatRackConfiguration(calc) },
    { label: "Растений", value: formatSmart(calc.plantCount) },
    { label: "Питание и нагрузка", value: `${calc.electrical.phaseLabel} · ${formatSmart(calc.electrical.totalPowerKw)} кВт` },
    { label: "Ежемесячные расходы", value: formatRub(calc.monthlyOperatingCost) },
    { label: cropCopy.monthlyYieldLabel, value: `${formatSmart(economy.produceKgPerMonth)} кг` },
    { label: cropCopy.salePriceLabel, value: `${formatRub(calc.salePricePerKg)} / кг` }
  ];
  const selectedLineItems = calc.lineItems.filter((item) => item.included);
  const assemblyRows = selectedLineItems
    .map((item) => ({ label: item.label, value: formatRub(item.total) }))
    .concat({ label: "Итого", value: formatRub(calc.totalEquipmentCost) });
  const economyRows = [
    { label: "Инвестиции в запуск", value: formatRub(calc.totalEquipmentCost) },
    { label: "Операционные расходы / мес", value: formatRub(calc.monthlyOperatingCost) },
    { label: "Электроэнергия / мес", value: formatRub(calc.electrical.monthlyPowerCost) },
    { label: "Вода / мес", value: formatRub(calc.water.monthlyWaterCost) },
    { label: "Аренда / мес", value: formatRub(calc.monthlyRentCost) },
    { label: `${cropCopy.produceLabel} / мес`, value: `${formatSmart(economy.produceKgPerMonth)} кг` },
    { label: "Выручка / мес", value: formatRub(economy.revenueMonthReal) },
    { label: "Выручка / год", value: formatRub(economy.revenueYearReal) },
    { label: "Чистый поток / мес", value: formatRub(economy.netMonthReal) },
    { label: "Окупаемость", value: economy.paybackText }
  ];

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Расчет Klubnika Project</title>
  <style>
    :root {
      color: #173f2a;
      background: #fbf7ec;
      font-family: "Aptos", "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 36px;
      background: #fbf7ec;
    }
    .page {
      max-width: 880px;
      margin: 0 auto;
      padding: 34px;
      background: #fffaf0;
      border: 1px solid #ded7c8;
      border-radius: 24px;
    }
    h1,
    h2,
    h3,
    p {
      margin: 0;
    }
    h1 {
      font-size: 34px;
      line-height: 1.05;
      letter-spacing: -0.04em;
    }
    h2 {
      margin-top: 30px;
      font-size: 22px;
      letter-spacing: -0.02em;
    }
    h3 {
      margin-top: 24px;
      font-size: 16px;
    }
    .meta,
    .note {
      margin-top: 10px;
      color: #657168;
      line-height: 1.5;
    }
    table {
      width: 100%;
      margin-top: 14px;
      border-collapse: collapse;
      font-size: 15px;
    }
    td,
    th {
      padding: 11px 0;
      border-bottom: 1px solid #e6dfd0;
      text-align: left;
      vertical-align: top;
    }
    td:last-child,
    th:last-child {
      text-align: right;
      font-weight: 700;
      color: #0e5d31;
    }
    tr.total td {
      border-top: 2px solid #173f2a;
      border-bottom: 0;
      font-weight: 800;
    }
    .scenario th {
      color: #657168;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .scenario td,
    .scenario th {
      text-align: right;
    }
    .scenario td:first-child,
    .scenario th:first-child {
      text-align: left;
    }
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .page {
        border: 0;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>Расчет Klubnika Project</h1>
    <p class="meta">Сформировано: ${escapeHtml(generatedAt)}</p>

    <h2>Что получилось по вашим вводным</h2>
    ${renderReportTable(inputRows)}

    <h3>Состав сборки</h3>
    ${renderReportTable(assemblyRows, true)}

    <h2>Разбивка экономики</h2>
    ${renderReportTable(economyRows)}
    ${renderReportScenarioTable(economy.scenarios, cropCopy)}

    <p class="note">Это ориентир по сборке и экономике. Расчет не заменяет обследование объекта, проверку логистики, строительных работ, юридических ограничений и фактической урожайности.</p>
  </main>
</body>
</html>`;
}

function getCropCopy(calc) {
  const isCucumber = calc.cropProfile?.id === "cucumber";
  return {
    produceLabel: isCucumber ? "Огурец" : "Ягода",
    produceLabelGenitive: isCucumber ? "огурца" : "ягоды",
    salePriceLabel: isCucumber ? "Цена реализации огурца" : "Цена реализации ягоды",
    monthlyYieldLabel: isCucumber ? "Выход огурца / мес" : "Выход ягоды / мес"
  };
}

function renderCropSpecificText(calc) {
  const copy = getCropCopy(calc);
  const priceFieldHead = document.querySelector(".compact-control[data-control-key='a5'] .compact-control-head");
  if (priceFieldHead) {
    priceFieldHead.innerHTML = `${copy.produceLabel}<br>₽/кг`;
  }

  const economyYieldLabel = elements.economyBerryKg?.previousElementSibling;
  if (economyYieldLabel) {
    economyYieldLabel.textContent = `${copy.produceLabel} / мес (оценка)`;
  }
}

function renderSummaryReveal() {
  if (elements.summaryRevealShell) {
    elements.summaryRevealShell.classList.toggle("is-locked", !summaryUnlocked);
  }
  if (elements.calcDetailsRevealShell) {
    elements.calcDetailsRevealShell.classList.toggle("is-locked", !summaryUnlocked);
  }
  document.body.classList.toggle("calc-auth-locked", !summaryUnlocked);
}

function syncSummaryLoginLink() {
  const next = encodeURIComponent(window.location.pathname || "/calc/");
  if (elements.summaryLoginLink) {
    elements.summaryLoginLink.href = `../cabinet/login/?next=${next}`;
  }
  if (elements.calcDetailsLoginLink) {
    elements.calcDetailsLoginLink.href = `../cabinet/login/?next=${next}`;
  }
}

function detectRuntimeApiBase(configuredBase) {
  const configured = String(configuredBase || "").trim().replace(/\/+$/, "");
  const host = window.location.hostname;
  if (host === "127.0.0.1" || host === "localhost") {
    return readLocalApiBase(configured);
  }
  return configured;
}

function readLocalApiBase(configuredBase) {
  try {
    const params = new URLSearchParams(window.location.search);
    const liveOverride = params.get("liveApi");
    const localOverride = params.get("localApi");
    if (localOverride === "1") {
      window.localStorage.setItem(API_OVERRIDE_STORAGE_KEY, "local");
      return "http://127.0.0.1:8010/v1";
    }
    if (liveOverride === "1") {
      window.localStorage.setItem(API_OVERRIDE_STORAGE_KEY, "live");
      return configuredBase || "http://127.0.0.1:8010/v1";
    }
    const saved = window.localStorage.getItem(API_OVERRIDE_STORAGE_KEY) || "live";
    return saved === "local" ? "http://127.0.0.1:8010/v1" : (configuredBase || "http://127.0.0.1:8010/v1");
  } catch (error) {
    return configuredBase || "http://127.0.0.1:8010/v1";
  }
}

async function checkCabinetSession() {
  const host = window.location.hostname;
  if (host === "127.0.0.1" || host === "localhost") {
    return true;
  }

  const apiBase = detectRuntimeApiBase(AUTH_API_BASE_DEFAULT);
  const hasAdminSession = await hasSession(`${apiBase}/admin/auth/session`, {
    "X-KP-Admin-Session": readStoredSessionToken("admin")
  });
  if (hasAdminSession) {
    return true;
  }
  return hasSession(`${apiBase}/auth/session`, {
    "X-KP-Member-Session": readStoredSessionToken("member")
  });
}

function readStoredSessionToken(accountType) {
  const key = accountType === "admin" ? ADMIN_SESSION_STORAGE_KEY : MEMBER_SESSION_STORAGE_KEY;
  try {
    const current = window.sessionStorage.getItem(key) || "";
    if (current) return current;
  } catch {
    // ignore storage failures
  }
  try {
    const legacy = window.localStorage.getItem(key) || "";
    if (legacy) {
      try {
        window.sessionStorage.setItem(key, legacy);
      } catch {
        // ignore storage failures
      }
      window.localStorage.removeItem(key);
      return legacy;
    }
    return "";
  } catch {
    return "";
  }
}

async function hasSession(url, extraHeaders = {}) {
  try {
    const headers = { Accept: "application/json" };
    Object.entries(extraHeaders || {}).forEach(([key, value]) => {
      if (value) headers[key] = value;
    });
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include"
    });
    return response.ok;
  } catch {
    return false;
  }
}

function renderChoiceStates() {
  document.querySelectorAll("[data-choice-key]").forEach((button) => {
    const { choiceKey, choiceValue } = button.dataset;
    button.classList.toggle("is-active", String(state[choiceKey]) === choiceValue);
  });

  document.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.checked = Boolean(state[input.dataset.toggleKey]);
    const toggleCard = input.closest(".feature-toggle");
    if (toggleCard) {
      toggleCard.classList.toggle("is-active", input.checked);
    }
  });

  elements.roomQuickPresets.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.quickPreset === state.presetSize);
  });

}

function renderPanels() {
  elements.roomPanels.forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.roomPanel === state.roomMode);
  });
}

function renderConditionalSteps() {
  if (!elements.electricalStep) {
    return;
  }

  const hasElectricalAddon = Boolean(state.includeElectrical);
  elements.electricalStep.classList.toggle("is-visible", hasElectricalAddon);
  elements.electricalStep.setAttribute("aria-hidden", hasElectricalAddon ? "false" : "true");
}

function renderInputs() {
  CONTROL_CONFIG.forEach((control) => {
    document.querySelectorAll(`[data-key="${control.key}"]`).forEach((input) => {
      if (input === document.activeElement) {
        return;
      }

      input.value = formatInputValue(state[control.key]);
    });
  });
}

function parseNumericDraft(rawValue) {
  const normalized = String(rawValue ?? "").trim().replace(",", ".");
  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return NaN;
  }

  return Number.parseFloat(normalized);
}

function clampNumericValue(value, control) {
  return Math.min(control.max, Math.max(control.min, value));
}

function formatInputValue(value) {
  return String(value).replace(".", ",");
}

function renderAcceptedFields() {
  document.querySelectorAll(".compact-control[data-control-key]").forEach((field) => {
    field.classList.toggle("is-accepted", acceptedFields.has(field.dataset.controlKey));
  });

  document.querySelectorAll("[data-accepted-mark]").forEach((mark) => {
    mark.hidden = !acceptedFields.has(mark.dataset.acceptedMark);
  });
}

function renderDimensionHelper(calc) {
  if (!elements.dimensionHelperTitle || !elements.dimensionHelperText) {
    return;
  }

  const runLabel = calc.rackRunCount > 1
    ? calc.rackRunLengths.map((runLength) => formatSmart(runLength)).join(" + ")
    : formatSmart(calc.rackLength);
  elements.dimensionHelperTitle.textContent = `${formatSmart(calc.rackCount)} полосы × ${runLabel} м = ${formatSmart(calc.totalRackMetersPerTier)} м стеллажей на ярус • ${formatSmart(calc.plantCount)} растений`;
  if (elements.dimensionHelperText) {
    const effectiveLength = calc.growLengthPerLane;
    const roundingNote = Math.abs(calc.length - effectiveLength) > 0.001
      ? ` В помещение ${formatSmart(calc.length)} м на одну полосу помещается ${formatSmart(effectiveLength)} м стеллажей: длина собирается модулями по 2 м.`
      : "";
    const clearanceNote = ` По длине всегда держим минимум ${formatSmart(calc.lengthPrimaryClearance)} м с одной стороны и ${formatSmart(calc.lengthSecondaryClearance)} м с другой.`;
    const passageNote = calc.rackRunCount > 1
      ? ` По длине это ${formatSmart(calc.rackRunCount)} прогона с проходами по ${formatSmart(calc.serviceGapLength)} м между ними.`
      : "";
    const fitNote = ` Полная занятая длина на одну полосу: ${formatSmart(calc.requiredRoomLengthPerLane)} м.`;
    elements.dimensionHelperText.textContent = `${calc.heightProfile.title}: ${calc.heightProfile.note}${clearanceNote}${roundingNote}${passageNote}${fitNote} Дальше можно посмотреть состав и закупку ниже.`;
  }
}

function renderMicroResult(calc) {
  if (!elements.microResultTitle || !elements.microResultValue || !elements.microResultPills) {
    return;
  }

  const copy = GOAL_COPY[state.goalType] || GOAL_COPY.entry;
  const selectedOptions = calc.selectedItems.filter((item) => !isBaseAssemblyItem(item.id)).length;
  const driverText = state.roomMode === "have-room"
    ? "Размер, этажность и выбранные блоки"
    : "Типовой размер, этажность и выбранные блоки";
  const nextText = state.roomMode === "have-room"
    ? "Если помещение уже выбрано, дальше можно считать под объект"
    : "Если рамка подходит, дальше можно привязать её к реальному помещению";

  elements.microResultTitle.textContent = copy.title;
  elements.microResultValue.textContent = "Ключевые цифры собраны справа";
  if (elements.microResultText) {
    elements.microResultText.textContent = copy.meaning;
  }
  elements.calcEntryStatus.textContent = driverText;
  elements.microNextStep.textContent = nextText;
  if (elements.microResultElectricity) {
    elements.microResultElectricity.textContent = "Учтено в ежемесячных расходах";
  }
  if (elements.microResultWater) {
    elements.microResultWater.textContent = "Учтено в ежемесячных расходах";
  }
  if (elements.microResultRent) {
    elements.microResultRent.textContent = "Учтено в ежемесячных расходах";
  }
  if (elements.microResultOperating) {
    elements.microResultOperating.textContent = "Смотрите свод справа";
  }
  if (elements.microResultPowerProfile) {
    elements.microResultPowerProfile.textContent = "Детализация затрат и условий вынесена в правый сводный блок.";
  }
  elements.microResultPills.innerHTML = [
    "Геометрия помещения",
    "Этажность и размещение",
    "Техническая схема",
    "Комплектация проекта",
    selectedOptions ? "Выбраны доп. блоки" : "Базовая сборка"
  ].map((item) => `<span class="chip">${item}</span>`).join("");
}

function formatRackConfiguration(calc) {
  return `${formatSmart(calc.rackCount)} ${pluralize(calc.rackCount, "ряд", "ряда", "рядов")} × ${formatSmart(calc.growLengthPerLane)} м · ${formatSmart(calc.heightProfile.tiers)} ${pluralize(calc.heightProfile.tiers, "ярус", "яруса", "ярусов")}`;
}

function renderSummary(calc) {
  const sizeLabel = `${formatSmart(calc.width)} × ${formatSmart(calc.length)} м`;

  if (elements.summaryProgressCount) {
    elements.summaryProgressCount.textContent = state.roomMode === "have-room" ? "Считаем по вашему помещению" : "Считаем по примеру";
  }
  if (elements.summaryProgressText) {
    elements.summaryProgressText.textContent = state.roomMode === "have-room"
      ? "Размеры уже учтены в расчёте."
      : "Считаем на типовом размере.";
  }
  setAnimatedTotalEquipmentCost(calc.totalEquipmentCost);
  elements.summaryMeaningNote.textContent = "";

  elements.summaryGrid.innerHTML = [
    { label: "Формат", value: `${sizeLabel} · ${formatSmart(calc.width * calc.length)} м²` },
    { label: "Конфигурация", value: formatRackConfiguration(calc) },
    { label: "Растений", value: formatSmart(calc.plantCount) },
    { label: getCropCopy(calc).monthlyYieldLabel, value: `${formatSmart(calc.monthlyProduceKg)} кг/мес` }
  ].map(renderSummaryItem).join("");

  const selectedLineItems = calc.lineItems.filter((item) => item.included);
  elements.summaryBreakdown.innerHTML = selectedLineItems.map((item) => `
    <div class="summary-breakdown-row is-included">
      <div>
        <strong>${item.label}</strong>
      </div>
      <b>${formatRub(item.total)}</b>
    </div>
  `).join("") + `
    <div class="summary-breakdown-row is-total">
      <div>
        <strong>Итого</strong>
      </div>
      <b>${formatRub(calc.totalEquipmentCost)}</b>
    </div>
  `;

  if (elements.briefChipList) {
    elements.briefChipList.innerHTML = buildDriverChips(calc).map((item) => `<span class="brief-chip">${item}</span>`).join("");
  }
  if (elements.nextStepTitle) {
    elements.nextStepTitle.textContent = state.roomMode === "have-room"
      ? "Если цифра подходит, проверяем объект детально"
      : "Если цифра подходит, подставляем реальный объект";
  }
  if (elements.nextStepText) {
    elements.nextStepText.textContent = state.roomMode === "have-room"
      ? "Проверяем проходы, коммуникации и собираем финальную конфигурацию."
      : "Когда появится помещение, быстро привязываем расчёт к его ограничениям.";
  }
  elements.summaryInterpretationTitle.textContent = state.roomMode === "have-room"
    ? "Это уже не «пример в вакууме»"
    : "Это понятный ориентир на старте";
  if (elements.summaryInterpretationText) {
    elements.summaryInterpretationText.textContent = state.roomMode === "have-room"
      ? "Простыми словами: видно, что помещается, сколько это стоит и что делать дальше."
      : "Даже без объекта уже понятны порядок цифр и следующий шаг.";
  }
}

function setAnimatedTotalEquipmentCost(nextTotal) {
  if (!elements.totalEquipmentCost) {
    return;
  }

  const target = Math.max(0, Number(nextTotal || 0));
  triggerTotalFlash();
  if (totalDisplayValue === null || !Number.isFinite(totalDisplayValue)) {
    totalDisplayValue = target;
    elements.totalEquipmentCost.textContent = formatRub(target);
    return;
  }

  if (Math.round(totalDisplayValue) === Math.round(target)) {
    totalDisplayValue = target;
    elements.totalEquipmentCost.textContent = formatRub(target);
    return;
  }

  if (totalDisplayAnimationFrame) {
    window.cancelAnimationFrame(totalDisplayAnimationFrame);
    totalDisplayAnimationFrame = null;
  }

  const startValue = totalDisplayValue;
  const delta = target - startValue;
  const duration = 420;
  const startTime = performance.now();

  const animate = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - ((1 - progress) ** 3);
    totalDisplayValue = startValue + delta * eased;
    elements.totalEquipmentCost.textContent = formatRub(totalDisplayValue);

    if (progress < 1) {
      totalDisplayAnimationFrame = window.requestAnimationFrame(animate);
      return;
    }

    totalDisplayValue = target;
    elements.totalEquipmentCost.textContent = formatRub(target);
    totalDisplayAnimationFrame = null;
  };

  totalDisplayAnimationFrame = window.requestAnimationFrame(animate);
}

function triggerTotalFlash() {
  if (!elements.totalEquipmentCost) {
    return;
  }

  elements.totalEquipmentCost.classList.remove("is-updating");
  if (totalFlashTimeout) {
    window.clearTimeout(totalFlashTimeout);
    totalFlashTimeout = null;
  }

  void elements.totalEquipmentCost.offsetWidth;
  elements.totalEquipmentCost.classList.add("is-updating");
  totalFlashTimeout = window.setTimeout(() => {
    elements.totalEquipmentCost.classList.remove("is-updating");
    totalFlashTimeout = null;
  }, 360);
}

function renderDetails(calc) {
  const cropCopy = getCropCopy(calc);
  const fallbackProduceKgPerMonth = Number.isFinite(calc.monthlyProduceKg)
    ? calc.monthlyProduceKg
    : roundToStep((Number(calc.plantCount || 0) * 80) / 1000, 0.1, "nearest");
  const economy = calc.economy || {};
  const produceKgPerMonth = Number.isFinite(economy.monthlyYieldKgReal)
    ? economy.monthlyYieldKgReal
    : fallbackProduceKgPerMonth;
  const revenueMonthReal = Number.isFinite(economy.revenueMonthReal)
    ? economy.revenueMonthReal
    : roundToStep(produceKgPerMonth * (calc.salePricePerKg || 1600), 1, "nearest");
  const revenueYearReal = Number.isFinite(economy.revenueYearReal)
    ? economy.revenueYearReal
    : roundToStep(revenueMonthReal * 12, 1, "nearest");
  const netMonthReal = Number.isFinite(economy.netMonthReal)
    ? economy.netMonthReal
    : roundToStep(revenueMonthReal - (calc.monthlyOperatingCost || 0), 1, "nearest");
  const paybackText = Number.isFinite(economy.paybackMonthsReal)
    ? `${formatSmart(economy.paybackMonthsReal)} мес`
    : "Не рассчитывается";
  if (elements.equipmentWithoutSeedlings) {
    elements.equipmentWithoutSeedlings.textContent = formatRub(calc.equipmentWithoutSeedlings);
  }
  if (elements.seedlingsTotalCost) {
    elements.seedlingsTotalCost.textContent = formatRub(calc.seedlingsTotalCost);
  }
  if (elements.economyCapex) {
    elements.economyCapex.textContent = formatRub(calc.totalEquipmentCost);
  }
  if (elements.economyOpexTotal) {
    elements.economyOpexTotal.textContent = formatRub(calc.monthlyOperatingCost);
  }
  if (elements.economyOpexEnergy) {
    elements.economyOpexEnergy.textContent = formatRub(calc.electrical.monthlyPowerCost);
  }
  if (elements.economyOpexWater) {
    elements.economyOpexWater.textContent = formatRub(calc.water.monthlyWaterCost);
  }
  if (elements.economyOpexRent) {
    elements.economyOpexRent.textContent = formatRub(calc.monthlyRentCost);
  }
  if (elements.economyBerryKg) {
    elements.economyBerryKg.textContent = `${formatSmart(produceKgPerMonth)} кг`;
  }
  if (elements.economyRevenueMonthReal) {
    elements.economyRevenueMonthReal.textContent = formatRub(revenueMonthReal);
  }
  if (elements.economyRevenueYearReal) {
    elements.economyRevenueYearReal.textContent = formatRub(revenueYearReal);
  }
  if (elements.economyNetMonthReal) {
    elements.economyNetMonthReal.textContent = formatRub(netMonthReal);
  }
  if (elements.economyPaybackReal) {
    elements.economyPaybackReal.textContent = paybackText;
  }
  if (elements.economyScenariosGrid) {
    const scenarios = Array.isArray(economy.scenarios) ? economy.scenarios : [];
    elements.economyScenariosGrid.innerHTML = scenarios.map((scenario) => {
      const paybackScenarioText = Number.isFinite(scenario.paybackMonths)
        ? `${formatSmart(scenario.paybackMonths)} мес`
        : "Не рассчитывается";
      return `
        <li class="economy-scenario-row">
          <strong>${scenario.label}</strong>
          <span>${cropCopy.produceLabel} ${formatSmart(scenario.monthlyYieldKg)} кг/мес · Выручка ${formatRub(scenario.revenueMonth)}/мес · Чистый поток ${formatRub(scenario.netMonth)}/мес · Окупаемость ${paybackScenarioText}</span>
        </li>
      `;
    }).join("");
  }
  if (elements.assemblyIncludesList) {
    elements.assemblyIncludesList.innerHTML = calc.baseAssemblyIncludes.map((item) => `
      <div class="brief-chip">${item}</div>
    `).join("");
  }

  if (elements.budgetStructureGrid) {
    elements.budgetStructureGrid.innerHTML = calc.selectedItems.map((item) => `
      <div class="summary-item">
        <span>${item.label}</span>
        <strong>${formatRub(item.total)}</strong>
      </div>
    `).join("");
  }

  if (elements.detailNotes) {
    elements.detailNotes.innerHTML = [
      "Ориентир не учитывает индивидуальные строительные работы и нестандартную доработку объекта.",
      "Если помещение уже есть, финальная цифра зависит от проходов, логистики и фактической полезной площади.",
      "Если помещения ещё нет, этот расчёт нужен как рамка бюджета, чтобы не обсуждать проект вслепую.",
      `${cropCopy.salePriceLabel} для ориентиров принята: ${formatRub(calc.salePricePerKg)} за кг.`,
      `Оценка выхода ${cropCopy.produceLabelGenitive} (реалистичный сценарий): ${formatSmart(produceKgPerMonth)} кг/мес.`,
      `Вода: ориентир ${formatSmart(calc.water.monthlyM3)} м³/мес (${formatSmart(calc.water.dailyLiters)} л/день) из нормы до ${formatSmart(calc.water.perDripperMlPerDay)} мл/день на одну капельницу.`,
      `Маты: нужно ${formatSmart(calc.matCount)} шт, на закупку ${formatSmart(calc.matPacks)} пач. по 12 = ${formatSmart(calc.matUnitsForPurchase)} шт. Запас после округления: ${formatSmart(calc.spareMats)} шт.`,
      `Слепая трубка: нужно ${formatSmart(calc.blindTubeMeters)} м, на закупку ${formatSmart(calc.blindTubeCoils)} бух. по 200 м = ${formatSmart(calc.blindTubeMetersForPurchase)} м.`
    ].concat(
      calc.lineItems
        .filter((item) => !isBaseAssemblyItem(item.id) && item.includes?.length)
        .map((item) => `${item.label}: ${item.includes.join(", ")}`)
    ).map((item) => `<div class="detail-note">${item}</div>`).join("");
  }

  if (elements.electricalSummaryGrid) {
    elements.electricalSummaryGrid.innerHTML = [
      { label: "Питание", value: calc.electrical.phaseLabel },
      { label: "Нагрузка", value: `${formatSmart(calc.electrical.totalPowerKw)} кВт` },
      { label: "Ток", value: `${formatSmart(calc.electrical.runningAmps)} А` },
      { label: "Вводной автомат", value: `${formatSmart(calc.electrical.inputBreakerA)} А` },
      { label: "Линии света", value: `${formatSmart(calc.electrical.totalLightLines)} шт` },
      { label: "Контакторы 2P", value: `${formatSmart(calc.electrical.contactorCount)} × ${formatSmart(calc.electrical.contactorRatingA)} А` },
      { label: "Кабель света", value: `${formatSmart(calc.electrical.allLightLinesM)} м` },
      { label: "Кабель всего", value: `${formatSmart(calc.electrical.totalCableM)} м` }
    ].map(renderSummaryItem).join("");
  }

  if (elements.electricalKitGrid) {
    elements.electricalKitGrid.innerHTML = calc.electrical.bomItems.map((item) => `
      <div class="summary-item">
        <span>${item.label}</span>
        <strong>${formatSmart(item.qty)} ${item.unit}</strong>
        <span>${item.spec}</span>
      </div>
    `).join("");
  }

  if (elements.electricalScheme) {
    elements.electricalScheme.textContent = "ВРУ -> щит фермы -> вводной автомат -> автоматы линий -> 2P контакторы -> линии драйверов 1/2 -> стеллажи. Отдельно идут вытяжка, сплит и сервисная группа.";
  }

  if (elements.electricalLines) {
    const energy = calc.electrical.monthlyElectricitySummary || {};
    elements.electricalLines.innerHTML = [
      `Свет: ${formatSmart(calc.electrical.lightCount)} светильников = ${formatSmart(calc.electrical.lightPowerTotalKw)} кВт. Считаем ${formatSmart(calc.electrical.driverSideLineCount)} линий драйверов 1 и ${formatSmart(calc.electrical.driverSideLineCount)} линий драйверов 2.`,
      `На одну линию света закладываем до ${formatSmart(calc.electrical.lightLineAmps)} А. Рекомендуемый автомат линии = ${formatSmart(calc.electrical.lightLineBreakerA)} А, контактор = ${formatSmart(calc.electrical.contactorRatingA)} А 2P.`,
      `Кабель до стеллажей: ${formatSmart(calc.electrical.totalLightLines)} линий по ${formatSmart(calc.electrical.oneLightLineM)} м. По схеме "${calc.electrical.cableLayoutLabel}" это даёт около ${formatSmart(calc.electrical.allLightLinesM)} м силового кабеля света${calc.rackRunCount > 1 ? ` с учётом проходов между прогонами по ${formatSmart(calc.serviceGapLength)} м` : ""}.`,
      `Вытяжка: до ${formatSmart(calc.electrical.exhaustPowerW / 1000)} кВт, кабель около ${formatSmart(calc.electrical.exhaustLineM)} м. Сервисная группа: ${formatSmart(calc.electrical.serviceSocketPoints)} точек, резерв ${formatSmart(calc.electrical.serviceReserveW / 1000)} кВт, кабель около ${formatSmart(calc.electrical.serviceLineM)} м.`
      ,
      `Расход на месяц: ${formatSmart(calc.electrical.monthlyKwh)} кВт⋅ч · ${formatRub(calc.electrical.monthlyPowerCost)} (свет: ${formatSmart(energy.lightKwhPerDay || 0)} кВт⋅ч/день, кондер: ${formatSmart(energy.condenserKwhPerDay || 0)} кВт⋅ч/день, вытяжка: ${formatSmart(energy.exhaustKwhPerDay || 0)} кВт⋅ч/день, насос: ${formatSmart(energy.pumpKwhPerDay || 0)} кВт⋅ч/день, автоматика: ${formatSmart(energy.automationKwhPerDay || 0)} кВт⋅ч/день), вода: ${formatSmart(calc.water.monthlyM3)} м³ · ${formatRub(calc.water.monthlyWaterCost)}, аренда: ${formatRub(calc.monthlyRentCost)}, всего: ${formatRub(calc.monthlyOperatingCost)}.`
    ].concat(
      calc.electrical.splitInputW
        ? [`Сплит: холодопроизводительность около ${formatSmart(calc.electrical.splitBtu)} BTU/h, потребление примерно ${formatSmart(calc.electrical.splitInputW / 1000)} кВт, кабель около ${formatSmart(calc.electrical.splitLineM)} м.`]
        : []
    ).map((item) => `<div class="detail-note">${item}</div>`).join("");
  }
}

function resolveEconomyReport(calc) {
  const fallbackProduceKgPerMonth = Number.isFinite(calc.monthlyProduceKg)
    ? calc.monthlyProduceKg
    : roundToStep((Number(calc.plantCount || 0) * 80) / 1000, 0.1, "nearest");
  const economy = calc.economy || {};
  const produceKgPerMonth = Number.isFinite(economy.monthlyYieldKgReal)
    ? economy.monthlyYieldKgReal
    : fallbackProduceKgPerMonth;
  const revenueMonthReal = Number.isFinite(economy.revenueMonthReal)
    ? economy.revenueMonthReal
    : roundToStep(produceKgPerMonth * (calc.salePricePerKg || 1600), 1, "nearest");
  const revenueYearReal = Number.isFinite(economy.revenueYearReal)
    ? economy.revenueYearReal
    : roundToStep(revenueMonthReal * 12, 1, "nearest");
  const netMonthReal = Number.isFinite(economy.netMonthReal)
    ? economy.netMonthReal
    : roundToStep(revenueMonthReal - (calc.monthlyOperatingCost || 0), 1, "nearest");
  const paybackText = Number.isFinite(economy.paybackMonthsReal)
    ? `${formatSmart(economy.paybackMonthsReal)} мес`
    : "Не рассчитывается";

  return {
    produceKgPerMonth,
    revenueMonthReal,
    revenueYearReal,
    netMonthReal,
    paybackText,
    scenarios: Array.isArray(economy.scenarios) ? economy.scenarios : []
  };
}

function renderReportTable(rows, markLastAsTotal = false) {
  return `
    <table>
      <tbody>
        ${rows.map((row, index) => `
          <tr class="${markLastAsTotal && index === rows.length - 1 ? "total" : ""}">
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.value)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderReportScenarioTable(scenarios, cropCopy) {
  if (!scenarios.length) {
    return "";
  }

  return `
    <h3>Сценарии</h3>
    <table class="scenario">
      <thead>
        <tr>
          <th>Сценарий</th>
          <th>${escapeHtml(cropCopy.produceLabel)} / мес</th>
          <th>Выручка / мес</th>
          <th>Чистый поток / мес</th>
          <th>Окупаемость</th>
        </tr>
      </thead>
      <tbody>
        ${scenarios.map((scenario) => {
          const paybackText = Number.isFinite(scenario.paybackMonths)
            ? `${formatSmart(scenario.paybackMonths)} мес`
            : "Не рассчитывается";
          return `
            <tr>
              <td>${escapeHtml(scenario.label)}</td>
              <td>${escapeHtml(`${formatSmart(scenario.monthlyYieldKg)} кг`)}</td>
              <td>${escapeHtml(formatRub(scenario.revenueMonth))}</td>
              <td>${escapeHtml(formatRub(scenario.netMonth))}</td>
              <td>${escapeHtml(paybackText)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderDebug(calc) {
  if (elements.debugBuildId) {
    elements.debugBuildId.textContent = BUILD_ID;
  }
  if (elements.debugTotal) {
    elements.debugTotal.textContent = formatRub(calc.totalEquipmentCost);
  }
  if (elements.debugGoal) {
    elements.debugGoal.textContent = state.goalType;
  }
  if (elements.debugRoom) {
    elements.debugRoom.textContent = state.roomMode;
  }
  if (elements.debugSize) {
    elements.debugSize.textContent = `${formatSmart(state.a0)}×${formatSmart(state.a1)}×${formatSmart(state.a2)}`;
  }
}

function setDebugAppPhase(value) {
  if (elements.debugAppPhase) {
    elements.debugAppPhase.textContent = value;
  }
}

function setDebugAppError(value) {
  if (elements.debugAppError) {
    elements.debugAppError.textContent = String(value).slice(0, 120);
  }
}

function setDebugGlobalError(value) {
  if (elements.debugGlobalError) {
    elements.debugGlobalError.textContent = String(value).slice(0, 120);
  }
}

function renderSummaryItem(item) {
  return `
    <div class="summary-item">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `;
}

function buildDriverChips(calc) {
  const chips = [
    "Геометрия помещения",
    "Стеллажная схема",
    "Этажность",
    "Инженерный контур",
    "Комплектация",
    "Ограничения объекта"
  ];

  calc.selectedItems
    .filter((item) => !isBaseAssemblyItem(item.id))
    .slice(0, 3)
    .forEach((item) => chips.push(item.label));

  return chips;
}

function formatLineMeta(item) {
  if (item.unit === "м²" && item.total) {
    return `${formatSmart(item.qty)} ${item.unit} × ${formatRub(item.unitPrice)}, округление = ${formatRub(item.total)}`;
  }

  if (item.id === "electrical" && item.total) {
    return `${formatSmart(item.qty)} линий света, щит, автоматы, контакторы, кабель, WAGO и коробки = ${formatRub(item.total)}`;
  }

  return `${formatSmart(item.qty)} ${item.unit} × ${formatRub(item.unitPrice)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatOptionPrice(group, calc = latestCalculation) {
  const total = resolveOptionPreviewTotal(group, calc);
  if (Number.isFinite(total) && total > 0) {
    return `+${formatRub(total)}`;
  }

  if (group.type === "electricalAuto") {
    return "по нагрузке";
  }

  if (group.type === "perAreaRounded") {
    return "по площади";
  }

  if (group.type === "perPlant") {
    return "по растениям";
  }

  return "в расчете";
}

function resolveOptionPreviewTotal(group, calc) {
  if (!group) {
    return 0;
  }

  if (group.type === "fixed") {
    return Math.max(group.unitPrice || 0, group.minTotal || 0);
  }

  if (!calc) {
    return group.unitPrice || 0;
  }

  if (group.type === "perPlant") {
    const rawTotal = (calc.plantCount || 0) * (group.unitPrice || 0);
    return Math.max(rawTotal, group.minTotal || 0);
  }

  if (group.type === "perAreaRounded") {
    const rawTotal = (calc.area || 0) * (group.unitPrice || 0);
    const roundedTotal = roundToStep(rawTotal, group.roundTo || 1, group.roundMode || "nearest");
    return Math.max(roundedTotal, group.minTotal || 0);
  }

  if (group.type === "electricalAuto") {
    const electrical = calc.electrical || {};
    const pricingModel = group.pricingModel || {};
    const rawElectricalTotal = (pricingModel.shieldBase || 0)
      + (pricingModel.inputBreakerUnitPrice || 0)
      + (electrical.totalLightLines || 0) * (pricingModel.lightLineBreakerUnitPrice || 0)
      + (electrical.contactorCount || 0) * (pricingModel.contactorUnitPrice || 0)
      + (electrical.smartRelayCount || 0) * (pricingModel.smartRelayUnitPrice || 0)
      + (electrical.exhaustPowerW ? (pricingModel.exhaustBreakerUnitPrice || 0) : 0)
      + (electrical.serviceSocketPoints ? (pricingModel.serviceBreakerUnitPrice || 0) : 0)
      + (electrical.splitInputW ? (pricingModel.splitBreakerUnitPrice || 0) : 0)
      + (electrical.allLightLinesM || 0) * (pricingModel.lightCablePerMeter || 0)
      + (electrical.exhaustLineM || 0) * (pricingModel.exhaustCablePerMeter || 0)
      + (electrical.serviceLineM || 0) * (pricingModel.serviceCablePerMeter || 0)
      + (electrical.splitLineM || 0) * (pricingModel.splitCablePerMeter || 0)
      + (electrical.wagoCount || 0) * (pricingModel.wagoUnitPrice || 0)
      + (electrical.junctionBoxCount || 0) * (pricingModel.junctionBoxUnitPrice || 0);
    const roundedTotal = roundToStep(rawElectricalTotal, pricingModel.roundTo || 5000, "up");
    return Math.max(roundedTotal, pricingModel.minTotal || 0);
  }

  return Math.max(group.unitPrice || 0, group.minTotal || 0);
}

function isBaseAssemblyItem(id) {
  return String(id || "").startsWith("base-");
}

function pluralize(value, one, few, many) {
  const n = Math.abs(Math.trunc(Number(value) || 0));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function renderFeatureToggleNotes(calc) {
  document.querySelectorAll("[data-option-note]").forEach((node) => {
    const group = (pricing.optionGroups || []).find((item) => item.id === node.dataset.optionNote);
    if (!group) {
      return;
    }
    node.textContent = formatOptionPrice(group, calc);
  });
}

function roundToThousands(value) {
  return Math.round((value || 0) / 1000) * 1000;
}

function roundToStep(value, step, mode = "nearest") {
  const safeValue = value || 0;
  if (!step) return safeValue;
  if (mode === "up") {
    return Math.ceil(safeValue / step) * step;
  }
  return Math.round(safeValue / step) * step;
}
