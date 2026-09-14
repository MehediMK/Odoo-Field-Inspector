/**
 * Field Inspector - Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  - Track per-tab "enabled" state purely for badge display (source of truth
 *    for actual behavior always lives in the content script of that tab).
 *  - Reset badge/state when a tab navigates or closes, since the content
 *    script is destroyed and re-injected fresh on every navigation.
 *
 * This worker never reads page content and never talks to any external
 * server — it only relays small status messages between the popup and the
 * content script for badge bookkeeping.
 */

const tabEnabledState = new Map();

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
    }
  } catch (err) {
    console.error("[Field Inspector] background message handler error:", err);
  }
  // No async response needed from background for this message type.
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabEnabledState.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    // A full navigation destroys the previously injected content script;
    // the inspector always starts OFF on a freshly loaded page.
    tabEnabledState.delete(tabId);
    setBadge(tabId, false);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Field Inspector] installed/updated. Click the toolbar icon to open the popup and enable inspection.");
});
