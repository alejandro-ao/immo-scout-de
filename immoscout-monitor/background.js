const SOUND_URL = chrome.runtime.getURL('notification.mp3');
let pendingListings = [];

async function showNotification(listings) {
  const count = listings.length;
  const firstTitle = listings[0].title;

  const body = count === 1
    ? firstTitle
    : `${firstTitle} (+${count - 1} more)`;

  pendingListings = listings;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: count === 1 ? 'New Listing Found!' : `${count} New Listings Found!`,
    message: body,
    priority: 2
  }, notificationId => {
    if (chrome.runtime.lastError) {
      console.error('[Immoscout Monitor] Notification error:', chrome.runtime.lastError.message);
    } else {
      console.log('[Immoscout Monitor] Notification created:', notificationId);
    }
  });

  // Flash the tab to get user's attention
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    console.log('[Immoscout Monitor] Flashing tab:', tab.id);
    // Briefly deactivate and reactivate to flash taskbar
    chrome.tabs.update(tab.id, { active: false }, () => {
      setTimeout(() => {
        chrome.tabs.update(tab.id, { active: true }, () => {
          console.log('[Immoscout Monitor] Tab flashed');
        });
      }, 100);
    });
  }
}

chrome.notifications.onClicked.addListener(notificationId => {
  chrome.notifications.clear(notificationId);

  if (pendingListings.length > 0) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'HIGHLIGHT_LISTINGS',
          listings: pendingListings
        });
      }
    });
  }

  pendingListings = [];
});
    return contexts.length > 0;
  }

  const matchedClients = await clients.matchAll();
  return matchedClients.some(client => client.url === chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH));
}

async function setupOffscreenDocument() {
  if (!canUseOffscreenAudio()) {
    throw new Error('chrome.offscreen is unavailable in this browser');
  }

  if (await hasOffscreenDocument()) {
    return;
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play a notification sound when new listings appear.'
  });

  try {
    await creatingOffscreenDocument;
  } finally {
    creatingOffscreenDocument = null;
  }
}

async function playNotificationSound() {
  if (!canUseOffscreenAudio()) {
    if (!warnedAboutMissingOffscreenApi) {
      console.warn('[Immoscout Monitor] Offscreen audio is unavailable. Falling back to notification-only alerts.');
      warnedAboutMissingOffscreenApi = true;
    }
    return false;
  }

  try {
    await setupOffscreenDocument();
    const response = await chrome.runtime.sendMessage({ type: 'PLAY_NOTIFICATION_SOUND' });
    if (!response?.success) {
      throw new Error(response?.error || 'Unknown offscreen playback error');
    }
    return true;
  } catch (err) {
    console.error('[Immoscout Monitor] Could not play sound:', err.message);
    return false;
  }
}

async function showNotification(listings, { playSound = true } = {}) {
  const count = listings.length;
  const firstTitle = listings[0].title;

  const body = count === 1
    ? firstTitle
    : `${firstTitle} (+${count - 1} more)`;

  if (playSound) {
    playNotificationSound();
  }

  pendingListings = listings;
  updateBadge(count);

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: count === 1 ? 'New Listing Found!' : `${count} New Listings Found!`,
    message: body,
    priority: 2
  }, notificationId => {
    if (chrome.runtime.lastError) {
      console.error('[Immoscout Monitor] Notification error:', chrome.runtime.lastError.message);
    } else {
      console.log('[Immoscout Monitor] Notification created:', notificationId);
    }
  });
}

chrome.notifications.onClicked.addListener(notificationId => {
  chrome.notifications.clear(notificationId);
  chrome.action.setBadgeText({ text: '' });

  if (pendingListings.length > 0) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'HIGHLIGHT_LISTINGS',
          listings: pendingListings
        });
      }
    });
  }

  pendingListings = [];
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Immoscout Monitor] Background received message:', message.type, message.listings?.length);
  if (message.type === 'NEW_LISTINGS') {
    showNotification(message.listings);
  } else if (message.type === 'TEST_NOTIFICATION') {
    showNotification([
      {
        id: 'test-listing',
        title: 'Test listing notification',
        link: ''
      }
    ]);
  } else {
    return false;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ lastSeenListings: [] });
  chrome.action.setBadgeText({ text: '' });
});

console.log('[Immoscout Monitor] Background script loaded');
