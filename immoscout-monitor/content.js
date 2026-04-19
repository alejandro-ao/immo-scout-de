(function () {
  'use strict';

  const POLL_INTERVAL = 180000;
  const STORAGE_KEY = 'lastSeenListings';
  const TAUSCH_PATTERNS = [/tauschwohnung/i, /wohnungstausch/i];

  let pollTimer = null;
  let isMonitoring = false;

  function isTauschWohnung(title) {
    return TAUSCH_PATTERNS.some(pattern => pattern.test(title));
  }

  function extractListings() {
    const containers = document.querySelectorAll('[data-id]');
    const listings = [];

    containers.forEach(el => {
      const id = el.getAttribute('data-id');
      const titleEl = el.querySelector('h2, h3, [class*="title"]');
      const title = titleEl?.textContent?.trim() || '';
      const linkEl = el.querySelector('a');
      const link = linkEl?.href || '';

      if (id && !isTauschWohnung(title)) {
        listings.push({ id, title, link });
      }
    });

    if (listings.length === 0) {
      const fallback = document.querySelectorAll('[class*="listing"]');
      fallback.forEach(el => {
        const id = el.getAttribute('data-id') ||
                   el.id ||
                   Math.random().toString(36).substr(2, 9);
        const titleEl = el.querySelector('h2, h3, [class*="title"]');
        const title = titleEl?.textContent?.trim() || '';
        const linkEl = el.querySelector('a');
        const link = linkEl?.href || '';

        if (!isTauschWohnung(title)) {
          listings.push({ id, title, link });
        }
      });
    }

    return listings;
  }

  async function getLastSeenListings() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, result => {
        resolve(result[STORAGE_KEY] || []);
      });
    });
  }

  async function saveLastSeenListings(listings) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: listings }, () => {
        resolve();
      });
    });
  }

  function findNewListings(current, previous) {
    const previousIds = new Set(previous.map(l => l.id));
    return current.filter(l => !previousIds.has(l.id));
  }

  async function checkForNewListings() {
    if (!isMonitoring) return;

    const currentListings = extractListings();
    const previousListings = await getLastSeenListings();
    const newListings = findNewListings(currentListings, previousListings);

    if (newListings.length > 0) {
      chrome.runtime.sendMessage({
        type: 'NEW_LISTINGS',
        listings: newListings
      });
    }

    await saveLastSeenListings(currentListings);
  }

  function startMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;
    checkForNewListings();
    pollTimer = setInterval(checkForNewListings, POLL_INTERVAL);
    chrome.runtime.sendMessage({ type: 'MONITORING_STARTED' });
  }

  function stopMonitoring() {
    isMonitoring = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    chrome.runtime.sendMessage({ type: 'MONITORING_STOPPED' });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATUS') {
      sendResponse({ isMonitoring });
    } else if (message.type === 'START') {
      startMonitoring();
      sendResponse({ success: true });
    } else if (message.type === 'STOP') {
      stopMonitoring();
      sendResponse({ success: true });
    } else if (message.type === 'CHECK_NOW') {
      checkForNewListings().then(() => sendResponse({ success: true }));
      return true;
    }
    return true;
  });

  console.log('[Immoscout Monitor] Content script loaded, found', document.querySelectorAll('[data-id]').length, 'listings');
})();
