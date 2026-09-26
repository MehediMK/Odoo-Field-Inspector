/**
 * Field Inspector - popup controller
 *
 * Reads/writes preferences via chrome.storage.local and drives the
 * per-tab content script via chrome.tabs.sendMessage, injecting it
 * on demand (activeTab + scripting) the first time it's needed.
 *
 * The list of files to inject comes from shared.js, which the service
 * worker also loads — the two must never drift apart.
 */

const { CONTENT_FILES, CONTENT_CSS, isInjectableUrl, autoEnableOriginForUrl, isOriginGranted, ACCENTS, DEFAULT_ACCENT } = self.FI_SHARED;

const DEFAULT_SETTINGS = self.FI_SHARED.DEFAULT_SETTINGS;

const REMEMBERED_SITES_KEY = "fiRememberedOrigins";

const els = {};
let currentTheme = "system";
let currentAccent = DEFAULT_ACCENT;
let activeTab = null;
let restricted = false;
let currentOrigin = "";

function isRestrictedUrl(url) {
  return !isInjectableUrl(url);
}

function readRememberedSites() {
  return chrome.storage.local
    .get(REMEMBERED_SITES_KEY)
    .then((stored) => (Array.isArray(stored[REMEMBERED_SITES_KEY]) ? stored[REMEMBERED_SITES_KEY] : []));
}

function setRememberHint(text, isError) {
  els.rememberHint.textContent = text;
  els.rememberHint.classList.toggle("fp-disabled-note", !!isError);
}

/**
 * Chrome's optional host permissions can be revoked from
 * chrome://extensions without the extension's own storage changing, so a
 * remembered entry can outlive its permission. Drop such a stale entry
 * instead of showing a checkbox that does nothing.
 */
async function dropStaleRememberedEntries() {
  const sites = await readRememberedSites();
  const kept = [];
  let changed = false;
  for (const origin of sites) {
    if (await isOriginGranted(origin)) kept.push(origin);
    else changed = true;
  }
  if (changed) await chrome.storage.local.set({ [REMEMBERED_SITES_KEY]: kept });
  return kept;
}

async function writeRememberedSites(origins) {
  await chrome.storage.local.set({ [REMEMBERED_SITES_KEY]: origins });
}

async function renderRememberedSites() {
  const sites = await readRememberedSites();
  els.rememberedList.textContent = "";
  for (const origin of sites) {
    const row = document.createElement("div");
    row.className = "fp-site-row";

    const label = document.createElement("span");
    label.className = "fp-site-origin";
    label.textContent = origin;
    label.title = origin;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "fp-site-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      removeRememberedSite(origin).catch((err) => console.error("[Field Inspector] remove site failed:", err));
    });

    row.append(label, remove);
    els.rememberedList.append(row);
  }
}

async function removeRememberedSite(origin) {
  // Give the access back to Chrome too, so a removed site is gone from
  // chrome://extensions too, not just from this extension's settings.
  await chrome.permissions.remove({ origins: [`${origin}/*`] }).catch(() => {});
  const sites = await readRememberedSites();
  await writeRememberedSites(sites.filter((entry) => entry !== origin));
  if (origin === currentOrigin) els.rememberSite.checked = false;
  await renderRememberedSites();
}

async function onRememberSiteChange() {
  const wantsOn = els.rememberSite.checked;
  if (!currentOrigin) {
    els.rememberSite.checked = false;
    return;
  }

  if (wantsOn) {
    // Must be the first await in this handler: permissions.request only
    // works while Chrome still considers us inside the click's user gesture.
    const granted = await chrome.permissions.request({ origins: [`${currentOrigin}/*`] });
    if (!granted) {
      els.rememberSite.checked = false;
      setRememberHint("Chrome denied access to this site. Nothing was changed — you can grant it from the extension's page in chrome://extensions.", true);
      return;
    }
    const sites = await readRememberedSites();
    if (!sites.includes(currentOrigin)) {
      await writeRememberedSites([...sites, currentOrigin]);
    }
    setRememberHint(`The inspector will start automatically on every page you load at ${currentOrigin}.`, false);
  } else {
    await chrome.permissions.remove({ origins: [`${currentOrigin}/*`] }).catch(() => {});
    const sites = await readRememberedSites();
    await writeRememberedSites(sites.filter((entry) => entry !== currentOrigin));
    setRememberHint("Turned off, and access to this site was removed.", false);
  }

  await renderRememberedSites();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get("fiSettings");
  return { ...DEFAULT_SETTINGS, ...(stored.fiSettings || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ fiSettings: settings });
}

function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function pingTab(tabId) {
  try {
    const response = await sendToTab(tabId, { type: "PING" });
    return !!(response && response.pong);
  } catch (err) {
    return false;
  }
}

async function ensureInjected(tabId) {
  const alreadyThere = await pingTab(tabId);
  if (alreadyThere) return true;

  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: CONTENT_CSS });
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    return true;
  } catch (err) {
    console.error("[Field Inspector] injection failed:", err);
    return false;
  }
}

function setStatusText(text, isError) {
  els.statusText.textContent = text;
  els.statusText.classList.toggle("fp-disabled-note", !!isError);
}

function setControlsEnabled(enabled) {
  els.formView.disabled = !enabled;
  els.listView.disabled = !enabled;
  els.highlight.disabled = !enabled;
  els.odooMode.disabled = !enabled;
  els.showSensitive.disabled = !enabled;
  els.interceptClicks.disabled = !enabled;
}

async function pushSettingsToTab(settings) {
  if (!activeTab) return;
  const isOn = els.enableToggle.checked;
  if (!isOn) return;
  try {
    await sendToTab(activeTab.id, { type: "FI_UPDATE_SETTINGS", settings });
  } catch (err) {
    // Content script may not be present (e.g. tab navigated); ignore.
  }
}

async function onEnableToggleChange() {
  if (!activeTab || restricted) {
    els.enableToggle.checked = false;
    return;
  }

  const settings = await loadSettings();

  if (els.enableToggle.checked) {
    setStatusText("Starting inspector…");
    const ok = await ensureInjected(activeTab.id);
    if (!ok) {
      els.enableToggle.checked = false;
      setStatusText("Could not start on this page.", true);
      return;
    }
    try {
      await sendToTab(activeTab.id, { type: "FI_ENABLE", settings });
      setStatusText("Inspector active — click a field on the page.");
      setControlsEnabled(true);
    } catch (err) {
      els.enableToggle.checked = false;
      setStatusText("Could not start on this page.", true);
    }
  } else {
    try {
      await sendToTab(activeTab.id, { type: "FI_DISABLE" });
    } catch (err) {
      /* content script already gone (e.g. navigation) — nothing to do */
    }
    setStatusText("Inspector is off.");
    setControlsEnabled(false);
  }
}

async function onSettingChange() {
  const settings = {
    formView: els.formView.checked,
    listView: els.listView.checked,
    highlight: els.highlight.checked,
    odooMode: els.odooMode.checked,
    showSensitiveValues: els.showSensitive.checked,
    interceptClicks: els.interceptClicks.checked,
    copyFormat: document.querySelector('input[name="fp-copy-format"]:checked').value,
    theme: currentTheme,
    accent: currentAccent,
  };
  await saveSettings(settings);
  await pushSettingsToTab(settings);
}

function applySettingsToUI(settings) {
  els.formView.checked = settings.formView;
  els.listView.checked = settings.listView;
  els.highlight.checked = settings.highlight;
  els.odooMode.checked = settings.odooMode;
  els.showSensitive.checked = !!settings.showSensitiveValues;
  els.interceptClicks.checked = settings.interceptClicks !== false;
  const radio = document.getElementById(settings.copyFormat === "json" ? "fp-copy-json" : "fp-copy-text");
  if (radio) radio.checked = true;
  currentTheme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system";
  currentAccent = ACCENTS[settings.accent] ? settings.accent : DEFAULT_ACCENT;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === currentTheme));
  });
  document.querySelectorAll("[data-accent-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.accentChoice === currentAccent));
  });
  applyPopupTheme();
}

/**
 * Paints the popup itself from the same choice the in-page panel uses, so the
 * two never disagree. "system" is resolved here against matchMedia and written
 * as data-fp-theme, which is what popup.css keys its palettes off.
 */
function applyPopupTheme() {
  const resolved = currentTheme === "system"
    ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : currentTheme;
  document.documentElement.setAttribute("data-fp-theme", resolved);
  const colors = (ACCENTS[currentAccent] || ACCENTS[DEFAULT_ACCENT])[resolved];
  const root = document.documentElement.style;
  if (colors) {
    root.setProperty("--fp-accent", colors.strong);
    root.setProperty("--fp-accent-fg", colors.fg);
    root.setProperty("--fp-accent-soft", colors.soft);
  }
}

async function initRememberSite() {
  currentOrigin = activeTab ? autoEnableOriginForUrl(activeTab.url) : "";

  if (!currentOrigin) {
    els.rememberSite.disabled = true;
    els.rememberSite.checked = false;
    els.rememberOrigin.textContent = "this page";
    setRememberHint("The extension has no access to this page, so it can't be remembered.", true);
    return;
  }

  els.rememberOrigin.textContent = currentOrigin;
  const sites = await dropStaleRememberedEntries();
  els.rememberSite.checked = sites.includes(currentOrigin);

  if (els.rememberSite.checked) {
    setRememberHint(`The inspector starts automatically on every page you load at ${currentOrigin}. Turn it off to stop, or use “Disable Inspector” on the page to skip just this tab.`, false);
  }
}

async function init() {
  els.enableToggle = document.getElementById("fp-enable-toggle");
  els.statusText = document.getElementById("fp-status-text");
  els.formView = document.getElementById("fp-form-view");
  els.listView = document.getElementById("fp-list-view");
  els.highlight = document.getElementById("fp-highlight");
  els.odooMode = document.getElementById("fp-odoo-mode");
  els.showSensitive = document.getElementById("fp-show-sensitive");
  els.interceptClicks = document.getElementById("fp-intercept-clicks");
  els.rememberSite = document.getElementById("fp-remember-site");
  els.rememberOrigin = document.getElementById("fp-remember-origin");
  els.rememberHint = document.getElementById("fp-remember-hint");
  els.rememberedList = document.getElementById("fp-remembered-list");
  els.version = document.getElementById("fp-version");

  try {
    const manifest = chrome.runtime.getManifest();
    els.version.textContent = `v${manifest.version}`;
  } catch (err) {
    /* non-fatal */
  }

  const settings = await loadSettings();
  applySettingsToUI(settings);

  activeTab = await getActiveTab();

  if (!activeTab || isRestrictedUrl(activeTab.url)) {
    restricted = true;
    els.enableToggle.checked = false;
    els.enableToggle.disabled = true;
    setControlsEnabled(false);
    setStatusText("Not available on this page.", true);
  } else {
    const currentlyEnabled = await pingTab(activeTab.id).then(async (present) => {
      if (!present) return false;
      try {
        const state = await sendToTab(activeTab.id, { type: "GET_STATE" });
        if (state && state.settings) applySettingsToUI(state.settings);
        return !!(state && state.enabled);
      } catch (err) {
        return false;
      }
    });

    els.enableToggle.checked = currentlyEnabled;
    setControlsEnabled(currentlyEnabled);
    setStatusText(currentlyEnabled ? "Inspector active — click a field on the page." : "Inspector is off.");
  }

  await initRememberSite();
  await renderRememberedSites();

  els.enableToggle.addEventListener("change", onEnableToggleChange);
  els.rememberSite.addEventListener("change", () => {
    onRememberSiteChange().catch((err) => {
      console.error("[Field Inspector] remember-site toggle failed:", err);
      els.rememberSite.checked = false;
      setRememberHint("Could not change this setting. Try reopening the popup.", true);
    });
  });
  els.formView.addEventListener("change", onSettingChange);
  els.listView.addEventListener("change", onSettingChange);
  els.highlight.addEventListener("change", onSettingChange);
  els.odooMode.addEventListener("change", onSettingChange);
  els.showSensitive.addEventListener("change", onSettingChange);
  els.interceptClicks.addEventListener("change", onSettingChange);
  document.getElementById("fp-all-settings").addEventListener("click", () => {
    // The full-page settings (theme, accent, debug, remembered sites, privacy)
    // live in options/options.html, declared by the manifest's options_ui with
    // open_in_tab, so this opens a real tab rather than a cramped popup.
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("fp-copy-text").addEventListener("change", onSettingChange);
  document.getElementById("fp-copy-json").addEventListener("change", onSettingChange);
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      currentTheme = button.dataset.themeChoice;
      applyPopupTheme();
      onSettingChange();
    });
  });
  document.querySelectorAll("[data-accent-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      currentAccent = button.dataset.accentChoice;
      applyPopupTheme();
      onSettingChange();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error("[Field Inspector] popup init failed:", err);
    setStatusText("Something went wrong. Try reopening the popup.", true);
  });
});
