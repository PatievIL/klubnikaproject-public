const MEMBER_SESSION_STORAGE_KEY = "klubnikaproject.member.session.v1";

const form = document.getElementById("kp-login-form");
const emailField = document.getElementById("kp-login-email");
const codeField = document.getElementById("kp-login-code");
const codePanel = document.getElementById("kp-login-code-panel");
const codeNote = document.getElementById("kp-login-code-note");
const submitButton = document.getElementById("kp-login-submit");
const resendButton = document.getElementById("kp-login-resend");
const changeEmailButton = document.getElementById("kp-login-change-email");
const statusNode = document.getElementById("kp-login-status");

let authStep = "email";
let activeEmail = "";
let resendTimer = 0;

function apiBase() {
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8010/v1";
  }
  return "https://api.klubnikaproject.ru/v1";
}

function safeRedirectPath(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
  }
}

function requestedRedirect() {
  const params = new URLSearchParams(window.location.search);
  return safeRedirectPath(params.get("redirecturl") || params.get("next"), "/cabinet/");
}

function setStatus(message, tone = "") {
  statusNode.textContent = message || "";
  statusNode.classList.toggle("is-error", tone === "error");
}

async function requestJson(path, options = {}) {
  const headers = {
    Accept: "application/json",
    "X-KP-Requested-With": "klubnikaproject",
    ...(options.headers || {}),
  };
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function clearLegacyMemberToken() {
  try {
    window.sessionStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in strict browser modes.
  }
  try {
    window.localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
  } catch {
    // Ignore legacy cleanup failures.
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setStep(nextStep, email = activeEmail) {
  authStep = nextStep;
  activeEmail = email;
  const isCodeStep = authStep === "code";
  codePanel.hidden = !isCodeStep;
  resendButton.hidden = !isCodeStep;
  emailField.disabled = isCodeStep;
  submitButton.textContent = isCodeStep ? "Войти" : "Получить код";
  if (isCodeStep) {
    codeNote.textContent = `Код отправлен на ${activeEmail}.`;
    codeField.focus();
  } else {
    codeField.value = "";
    codeNote.textContent = "";
    setResendCountdown(0);
    emailField.disabled = false;
    emailField.focus();
  }
}

function setResendCountdown(seconds) {
  clearInterval(resendTimer);
  let remaining = Math.max(0, Number(seconds || 0));
  renderResendState(remaining);
  if (!remaining) return;
  resendTimer = window.setInterval(() => {
    remaining -= 1;
    renderResendState(remaining);
    if (remaining <= 0) clearInterval(resendTimer);
  }, 1000);
}

function renderResendState(seconds) {
  if (!seconds) {
    resendButton.disabled = false;
    resendButton.textContent = "Отправить код ещё раз";
    return;
  }
  resendButton.disabled = true;
  resendButton.textContent = `Повторно через ${seconds} сек.`;
}

async function requestCode(email, { resend = false } = {}) {
  let codeRequested = false;
  submitButton.disabled = true;
  resendButton.disabled = true;
  setStatus(resend ? "Отправляем новый код..." : "Отправляем код на почту...");
  try {
    const data = await requestJson("/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    codeRequested = true;
    setStep("code", email);
    setResendCountdown(data.resend_after_seconds);
    const debugHint = data.debug_code ? ` Код для локальной проверки: ${data.debug_code}.` : "";
    setStatus(`Проверьте письмо и введите код.${debugHint}`);
  } catch (error) {
    if (error.status === 503) {
      setStatus("Отправка почты пока не настроена. Включите SMTP или AUTH_DEBUG_CODES.", "error");
    } else {
      setStatus("Не удалось отправить код. Проверьте email и попробуйте ещё раз.", "error");
    }
  } finally {
    submitButton.disabled = false;
    if (!codeRequested) renderResendState(0);
  }
}

async function verifyCode() {
  const code = String(codeField.value || "").replace(/\D+/g, "");
  if (code.length !== 6) {
    setStatus("Введите 6 цифр из письма.", "error");
    return;
  }

  submitButton.disabled = true;
  resendButton.disabled = true;
  setStatus("Проверяем код...");
  try {
    await requestJson("/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: activeEmail, code }),
    });
    clearLegacyMemberToken();
    setStatus("Вход выполнен. Открываем кабинет...");
    window.location.href = requestedRedirect();
  } catch {
    setStatus("Код не подошёл или устарел. Проверьте письмо или запросите новый код.", "error");
    submitButton.disabled = false;
    renderResendState(0);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authStep === "code") {
    await verifyCode();
    return;
  }

  const email = normalizeEmail(emailField.value);
  if (!isValidEmail(email)) {
    setStatus("Введите корректную эл. почту.", "error");
    return;
  }
  await requestCode(email);
});

resendButton.addEventListener("click", async () => {
  if (!activeEmail || resendButton.disabled) return;
  await requestCode(activeEmail, { resend: true });
});

changeEmailButton.addEventListener("click", () => {
  setStatus("");
  setStep("email", "");
});

codeField.addEventListener("input", () => {
  codeField.value = String(codeField.value || "").replace(/\D+/g, "").slice(0, 6);
});
