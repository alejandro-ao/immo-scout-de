(function () {
  'use strict';

  const DEFAULT_POLL_INTERVAL = 180000;
  const Jitter_MAX = 15000;
  const STORAGE_KEY = 'lastSeenListings';
  const SETTINGS_KEY = 'userSettings';
  const TAUSCH_PATTERNS = [/tauschwohnung/i, /wohnungstausch/i];

  let pollTimer = null;
  let isMonitoring = false;
  let pollInterval = DEFAULT_POLL_INTERVAL;

  function isTauschWohnung(title) {
    return TAUSCH_PATTERNS.some(pattern => pattern.test(title));
  }

  function parseListingsFromHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const listings = [];

    const containers = doc.querySelectorAll('[data-id]');

    if (containers.length === 0) {
      const fallback = doc.querySelectorAll('[class*="listing"]');
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
    } else {
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

  async function getCurrentPageUrl() {
    return new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        resolve(tabs[0]?.url || null);
      });
    });
  }

  async function checkForNewListings() {
    if (!isMonitoring) return;

    const pageUrl = await getCurrentPageUrl();
    if (!pageUrl || !pageUrl.includes('immobilienscout24.de')) {
      console.log('[Immoscout Monitor] Not on Immoscout page, skipping');
      return;
    }

    console.log(`[Immoscout Monitor] Fetching: ${pageUrl}`);
    const startTime = Date.now();

    try {
      const response = await fetch(pageUrl, { credentials: 'include' });
      const elapsed = Date.now() - startTime;
      console.log(`[Immoscout Monitor] Response: ${response.status} ${response.statusText} (${elapsed}ms)`);

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }

      const html = await response.text();
      console.log(`[Immoscout Monitor] HTML length: ${html.length} chars`);

      const currentListings = parseListingsFromHTML(html);
      const previousListings = await getLastSeenListings();
      const newListings = findNewListings(currentListings, previousListings);

      console.log(`[Immoscout Monitor] Listings: ${currentListings.length} found, ${newListings.length} new, ${previousListings.length} previous`);

      if (newListings.length > 0) {
        console.log(`[Immoscout Monitor] New listings:`, newListings.map(l => l.title));
        chrome.runtime.sendMessage({
          type: 'NEW_LISTINGS',
          listings: newListings
        });
      }

      await saveLastSeenListings(currentListings);
    } catch (err) {
      console.error(`[Immoscout Monitor] Error: ${err.message}`);
    }
  }

  function startMonitoring(refreshRate) {
    if (isMonitoring) return;
    isMonitoring = true;
    pollInterval = (refreshRate || DEFAULT_POLL_INTERVAL) * 1000;
    scheduleNextCheck();
    chrome.runtime.sendMessage({ type: 'MONITORING_STARTED' });
  }

  function scheduleNextCheck() {
    if (!isMonitoring) return;

    const jitter = Math.floor(Math.random() * Jitter_MAX);
    const delay = pollInterval + jitter;

    pollTimer = setTimeout(async () => {
      await checkForNewListings();
      scheduleNextCheck();
    }, delay);
  }

  function stopMonitoring() {
    isMonitoring = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    chrome.runtime.sendMessage({ type: 'MONITORING_STOPPED' });
  }

  function updateRefreshRate(newRate) {
    pollInterval = newRate * 1000;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATUS') {
      sendResponse({ isMonitoring });
    } else if (message.type === 'START') {
      startMonitoring(message.refreshRate);
      sendResponse({ success: true });
    } else if (message.type === 'STOP') {
      stopMonitoring();
      sendResponse({ success: true });
    } else if (message.type === 'CHECK_NOW') {
      checkForNewListings().then(() => sendResponse({ success: true }));
      return true;
    } else if (message.type === 'UPDATE_REFRESH_RATE') {
      updateRefreshRate(message.refreshRate);
      sendResponse({ success: true });
    }
    return true;
  });

  console.log('[Immoscout Monitor] Content script loaded (background fetch mode)');
})();
