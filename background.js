/**
 * Field Inspector - Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  - Track per-tab "enabled" state purely for badge display (source of truth
 *    for actual behavior always lives in the content script of that tab).
 *  - Reset badge/state when a tab navigates or closes, since the content
 *    script is destroyed and re-injected fresh on every navigation.
 *  - Re-inject and re-enable automatically on origins the user explicitly
 *    chose to remember, so the inspector survives the navigation that would
 *    otherwise silently turn it off.
 *
 * This worker never reads page content and never talks to any external
 * server — it only injects the extension's own scripts, relays small status
 * messages for badge bookkeeping, and reads the user's own preference
 * storage.
 */

importScripts("shared.js");

const { CONTENT_FILES, CONTENT_CSS, isRememberedOrigin, isInjectableUrl, isOriginGranted } = self.FI_SHARED;

const REMEMBERED_SITES_KEY = "fiRememberedOrigins";
const SETTINGS_KEY = "fiSettings";

const tabEnabledState = new Map();

/**
 * tabId -> origin where the user explicitly turned the inspector OFF.
 *
 * Without this, a remembered site would re-arm the inspector on every
 * reload, making the manual toggle pointless on exactly the sites where
 * auto-enable is enabled. Keyed per tab and per origin: navigating that tab
 * somewhere else clears it, closing the tab forgets it, and a browser
 * restart forgets it (a fresh session re-reads the remembered list).
 */
const manuallyDisabledTabs = new Map();

function setBadge(tabId, enabled) {
  chrome.action.setBadgeText({ tabId, text: enabled ? "ON" : "" }).catch(() => {});
  if (enabled) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#16a34a" }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  try {
    if (!message || typeof message.type !== "string") return;

    if (message.type === "FI_STATE_CHANGED" && sender.tab && typeof sender.tab.id === "number") {
      const tabId = sender.tab.id;
      tabEnabledState.set(tabId, !!message.enabled);
      setBadge(tabId, !!message.enabled);

      // Only an explicit user action suppresses auto-enable for this tab.
      // The content script also reports enabled:false from its own pagehide
      // handler on every navigation, and treating that as "user disabled it"
      // would permanently defeat the feature after the first page unload.
      if (!message.enabled && message.userInitiated) {
        const origin = self.FI_SHARED.autoEnableOriginForUrl(sender.tab.url);
        if (origin) manuallyDisabledTabs.set(tabId, origin);
        else manuallyDisabledTabs.delete(tabId);
      }
    }
  } catch (err) {
    console.error("[Field Inspector] background message handler error:", err);
  }
  // No async response needed from background for this message type.
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabEnabledState.delete(tabId);
  manuallyDisabledTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    // A full navigation destroys the previously injected content script;
    // the inspector always starts OFF on a freshly loaded page unless the
    // user has remembered this origin (handled below on "complete").
    tabEnabledState.delete(tabId);
    setBadge(tabId, false);

    // A remembered-site opt-out belongs to the origin it was made on, not
    // to the tab, so moving that tab to a different site restores normal
    // auto-enable there.
    const suppressedFor = manuallyDisabledTabs.get(tabId);
    if (suppressedFor && suppressedFor !== self.FI_SHARED.autoEnableOriginForUrl(tab && tab.url)) {
      manuallyDisabledTabs.delete(tabId);
    }
    return;
  }

  // "complete" is the only reliable point at which the document is ready
  // for injection. A remembered origin re-arms the inspector here; every
  // other page stays off until the user opens the popup again, which is
  // what keeps the extension's default footprint at zero.
  if (changeInfo.status === "complete") {
    autoEnableIfRemembered(tabId, tab && tab.url).catch((err) => {
      console.error("[Field Inspector] auto-enable failed:", err);
    });
  }
});

/**
 * Injects and enables the inspector in `tabId` when its origin is both in
 * the remembered list AND covered by a still-granted host permission.
 *
 * The permission is re-checked on every load on purpose: a user can revoke
 * an optional host permission from chrome://extensions without touching the
 * extension's own storage, and injecting without it would just throw.
 */
async function autoEnableIfRemembered(tabId, url) {
  if (typeof tabId !== "number" || !isInjectableUrl(url)) return;

  const stored = await chrome.storage.local.get(REMEMBERED_SITES_KEY);
  const remembered = stored[REMEMBERED_SITES_KEY];
  if (!isRememberedOrigin(url, remembered)) return;
  if (tabEnabledState.get(tabId)) return; // already on for this document

  const origin = self.FI_SHARED.autoEnableOriginForUrl(url);
  if (manuallyDisabledTabs.get(tabId) === origin) return; // user turned it off here
  if (!(await isOriginGranted(origin))) return;

  const settingsStored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = settingsStored[SETTINGS_KEY] || {};

  await chrome.scripting.insertCSS({ target: { tabId }, files: CONTENT_CSS });
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });

  // A response of undefined means no content script is listening (e.g. the
  // tab navigated again mid-injection); nothing to enable in that case.
  const response = await chrome.tabs.sendMessage(tabId, { type: "FI_ENABLE", settings }).catch(() => null);
  if (response && response.ok) {
    tabEnabledState.set(tabId, true);
    setBadge(tabId, true);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Field Inspector] installed/updated. Click the toolbar icon to open the popup and enable inspection.");
});
