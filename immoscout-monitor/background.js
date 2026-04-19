const SOUND_URL = chrome.runtime.getURL('notification.wav');
let audio = null;

function playSound() {
  if (!audio) {
    audio = new Audio(SOUND_URL);
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

async function showNotification(listings) {
  const count = listings.length;
  const firstTitle = listings[0].title;

  const body = count === 1
    ? firstTitle
    : `${firstTitle} (+${count - 1} more)`;

  playSound();

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: 'New Listing Found!',
    body: body,
    priority: 2
  }, notificationId => {
    if (chrome.runtime.lastError) {
      console.error('Notification error:', chrome.runtime.lastError);
    }
  });
}

chrome.notifications.onClicked.addListener(notificationId => {
  chrome.notifications.clear(notificationId);
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, { active: true });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_LISTINGS') {
    showNotification(message.listings);
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ lastSeenListings: [] });
});
