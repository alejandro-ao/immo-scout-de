const SOUND_URL = chrome.runtime.getURL('notification.wav');
let pendingListings = [];

async function playSoundInTab(tabId) {
  try {
    const soundUrl = chrome.runtime.getURL('notification.wav');
    await chrome.storage.local.set({ pendingSoundUrl: soundUrl });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['play-sound.js']
    });
  } catch (err) {
    console.error('[Immoscout Monitor] Could not play sound:', err.message);
  }
}

async function showNotification(listings) {
  const count = listings.length;
  const firstTitle = listings[0].title;

  const body = count === 1
    ? firstTitle
    : `${firstTitle} (+${count - 1} more)`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    playSoundInTab(tab.id);
  }

  pendingListings = listings;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: count === 1 ? 'New Listing Found!' : `${count} New Listings Found!`,
    body: body,
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
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ lastSeenListings: [] });
});

console.log('[Immoscout Monitor] Background script loaded');
