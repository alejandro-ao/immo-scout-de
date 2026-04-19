let pendingListings = [];

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#00d26a' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function showNotification(listings) {
  const count = listings.length;
  const firstTitle = listings[0].title;

  const body = count === 1
    ? firstTitle
    : `${firstTitle} (+${count - 1} more)`;

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

  // Flash the tab to get user's attention
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    console.log('[Immoscout Monitor] Flashing tab:', tab.id);
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
    showNotification([{ id: 'test', title: 'Test listing notification', link: '' }]);
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ lastSeenListings: [] });
  chrome.action.setBadgeText({ text: '' });
});

console.log('[Immoscout Monitor] Background script loaded');
