/**
 * Field Inspector - popup controller
 *
 * Reads/writes preferences via chrome.storage.local and drives the
 * per-tab content script via chrome.tabs.sendMessage, injecting it
 * on demand (activeTab + scripting) the first time it's needed.
 */

const DEFAULT_SETTINGS = {
  formView: true,
  listView: true,
  highlight: true,
  copyFormat: "text",
  odooMode: true,
};

const CONTENT_FILES = ["content/utils.js", "content/odoo.js", "content/detector.js", "content/ui.js", "content/content.js"];
const CONTENT_CSS = ["content.css"];

const els = {};
let activeTab = null;
let restricted = false;

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com")
  );
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
    copyFormat: document.querySelector('input[name="fp-copy-format"]:checked').value,
  };
  await saveSettings(settings);
  await pushSettingsToTab(settings);
}

function applySettingsToUI(settings) {
  els.formView.checked = settings.formView;
  els.listView.checked = settings.listView;
  els.highlight.checked = settings.highlight;
  els.odooMode.checked = settings.odooMode;
  const radio = document.getElementById(settings.copyFormat === "json" ? "fp-copy-json" : "fp-copy-text");
  if (radio) radio.checked = true;
}

async function init() {
  els.enableToggle = document.getElementById("fp-enable-toggle");
  els.statusText = document.getElementById("fp-status-text");
  els.formView = document.getElementById("fp-form-view");
  els.listView = document.getElementById("fp-list-view");
  els.highlight = document.getElementById("fp-highlight");
  els.odooMode = document.getElementById("fp-odoo-mode");
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

  els.enableToggle.addEventListener("change", onEnableToggleChange);
  els.formView.addEventListener("change", onSettingChange);
  els.listView.addEventListener("change", onSettingChange);
  els.highlight.addEventListener("change", onSettingChange);
  els.odooMode.addEventListener("change", onSettingChange);
  document.getElementById("fp-copy-text").addEventListener("change", onSettingChange);
  document.getElementById("fp-copy-json").addEventListener("change", onSettingChange);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error("[Field Inspector] popup init failed:", err);
    setStatusText("Something went wrong. Try reopening the popup.", true);
  });
});
