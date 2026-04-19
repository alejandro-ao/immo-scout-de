(function () {
  'use strict';

  const DEFAULT_POLL_INTERVAL = 180000;
  const Jitter_MAX = 15000;
  const STORAGE_KEY = 'lastSeenListings';
  const SETTINGS_KEY = 'userSettings';
  const TAUSCH_PATTERNS = [/tauschwohnung/i, /wohnungstausch/i];
  const SECTION_HEADER_PATTERN = /^\d+\s+passende/i;

  let pollTimer = null;
  let isMonitoring = false;
  let pollInterval = DEFAULT_POLL_INTERVAL;

  function isTauschWohnung(title) {
    return TAUSCH_PATTERNS.some(pattern => pattern.test(title));
  }

  function isValidListing(title) {
    if (!title || title.trim() === '') return false;
    if (SECTION_HEADER_PATTERN.test(title)) return false;
    return true;
  }

  function generateListingId(title, link) {
    const str = `${title}|${link}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function parseListingsFromHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const listings = [];

    const containers = doc.querySelectorAll('[data-id]');

    if (containers.length === 0) {
      const fallback = doc.querySelectorAll('[class*="listing"]');
      fallback.forEach(el => {
        const titleEl = el.querySelector('h2, h3, [class*="title"]');
        const title = titleEl?.textContent?.trim() || '';
        const linkEl = el.querySelector('a');
        const link = linkEl?.href || '';

        if (isValidListing(title) && !isTauschWohnung(title)) {
          const id = generateListingId(title, link);
          listings.push({ id, title, link });
        }
      });
    } else {
      containers.forEach(el => {
        const titleEl = el.querySelector('h2, h3, [class*="title"]');
        const title = titleEl?.textContent?.trim() || '';
        const linkEl = el.querySelector('a');
        const link = linkEl?.href || '';

        if (isValidListing(title) && !isTauschWohnung(title)) {
          const id = generateListingId(title, link);
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

  function getCurrentPageUrl() {
    return window.location.href;
  }

  async function checkForNewListings() {
    if (!isMonitoring) return;

    const pageUrl = getCurrentPageUrl();
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
        }).then(() => {
          console.log('[Immoscout Monitor] Message sent to background');
        }).catch(err => {
          console.error('[Immoscout Monitor] Message send failed:', err.message);
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

  function autoFillForm(settings) {
    const formSelectors = {
      message: 'textarea[id="message"]',
      salutation: 'select[name="salutation"]',
      firstName: 'input[id="firstName"]',
      lastName: 'input[id="lastName"]',
      phoneNumber: 'input[id="phoneNumber"]',
      street: 'input[id="street"]',
      houseNumber: 'input[id="houseNumber"]',
      postcode: 'input[id="postcode"]',
      city: 'input[id="city"]',
      incomeAmount: 'input[id="incomeAmount"]',
      numberOfAdults: 'input[id="numberOfAdults"]',
      numberOfKids: 'input[id="numberOfKids"]',
      hasPets: 'select[name="hasPets"]'
    };

    const fieldMappings = {
      firstName: settings.firstName,
      lastName: settings.lastName,
      phoneNumber: settings.phone,
      incomeAmount: settings.monthlyIncome,
      message: settings.messageTemplate,
      numberOfAdults: settings.numberOfAdults || '1',
      numberOfKids: settings.numberOfKids || '0',
      hasPets: settings.hasPets || ''
    };

    const addressParts = (settings.address || '').split(' ');
    const street = addressParts.slice(0, -1).join(' ') || settings.address;
    const houseNumber = addressParts[addressParts.length - 1] || '';

    const cityPostcode = settings.address ? settings.address.match(/(\d{5})\s+(.+)/) : null;
    const postcode = cityPostcode ? cityPostcode[1] : '';
    const city = cityPostcode ? cityPostcode[2] : '';

    let filled = 0;

    Object.entries(formSelectors).forEach(([key, selector]) => {
      const el = document.querySelector(selector);
      if (!el) return;

      let value = '';

      if (key === 'salutation') {
        if (settings.salutation) {
          el.value = settings.salutation;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filled++;
        }
      } else if (key === 'street') {
        value = street;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (key === 'houseNumber') {
        value = houseNumber;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (key === 'postcode') {
        value = postcode;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (key === 'city') {
        value = city;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (key === 'numberOfKids') {
        value = fieldMappings.numberOfKids || '0';
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (key === 'hasPets') {
        if (fieldMappings.hasPets) {
          el.value = fieldMappings.hasPets;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filled++;
        }
      } else if (fieldMappings[key]) {
        value = fieldMappings[key];
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    console.log(`[Immoscout Monitor] Auto-filled ${filled} fields`);
  }

  function findListingElement(listing) {
    const allEls = document.querySelectorAll('[data-id], [class*="listing"]');
    for (const el of allEls) {
      const titleEl = el.querySelector('h2, h3, [class*="title"]');
      const title = titleEl?.textContent?.trim() || '';
      const linkEl = el.querySelector('a');
      const link = linkEl?.href || '';
      const id = generateListingId(title, link);
      if (id === listing.id) {
        return el;
      }
    }
    return null;
  }

  function highlightListings(listings) {
    const style = document.createElement('style');
    style.id = 'immoscout-monitor-highlight';
    style.textContent = `
      @keyframes immoscout-highlight-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(0, 210, 106, 0.7); }
        50% { box-shadow: 0 0 0 15px rgba(0, 210, 106, 0); }
      }
      .immoscout-new-listing {
        animation: immoscout-highlight-pulse 1.5s ease-in-out 3;
        outline: 3px solid #00d26a !important;
        position: relative;
        z-index: 1000;
      }
    `;
    document.head.appendChild(style);

    let highlighted = 0;
    listings.forEach(listing => {
      const el = findListingElement(listing);
      if (el) {
        el.classList.add('immoscout-new-listing');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlighted++;
        setTimeout(() => {
          el.classList.remove('immoscout-new-listing');
        }, 5000);
      }
    });

    setTimeout(() => {
      const styleEl = document.getElementById('immoscout-monitor-highlight');
      if (styleEl) styleEl.remove();
    }, 6000);

    console.log(`[Immoscout Monitor] Highlighted ${highlighted} of ${listings.length} listings`);
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
    } else if (message.type === 'HIGHLIGHT_LISTINGS') {
      highlightListings(message.listings);
    } else if (message.type === 'TEST_NOTIFICATION') {
      console.log('[Immoscout Monitor] TEST: Pretending current listings are new');
      chrome.storage.local.set({ lastSeenListings: [] });
      checkForNewListings();
    } else if (message.type === 'AUTO_FILL_FORM') {
      autoFillForm(message.settings);
    }
    return true;
  });

  console.log('[Immoscout Monitor] Content script loaded (background fetch mode)');
})();
