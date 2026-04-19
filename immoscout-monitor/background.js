const SOUND_URL = chrome.runtime.getURL('notification.wav');
let audio = null;
let pendingListings = [];

function playSound() {
  if (!audio) {
    audio = new Audio(SOUND_URL);
  }
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log('[Immoscout Monitor] Sound played');
  }).catch(err => {
    console.error('[Immoscout Monitor] Sound error:', err.message);
  });
}

async function showNotification(listings) {
  const count = listings.length;
  const firstTitle = listings[0].title;

  const body = count === 1
    ? firstTitle
    : `${firstTitle} (+${count - 1} more)`;

  playSound();

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
