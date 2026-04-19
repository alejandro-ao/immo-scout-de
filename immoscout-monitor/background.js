let pendingListings = [];

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#00d26a' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function sendTelegramMessage(listings) {
  const settings = await new Promise(resolve => {
    chrome.storage.local.get('userSettings', result => {
      resolve(result.userSettings || {});
    });
  });

  if (!settings.telegramBotToken || !settings.telegramChatId) {
    console.log('[Immoscout Monitor] Telegram not configured, skipping');
    return;
  }

const count = listings.length;
  const message = listings.map(l => `${l.title}\n${l.link}`).join('\n\n');
  const fullMessage = `[IMMOSCOUT] ${count} new listing${count > 1 ? 's' : ''}!\n\n${message}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        text: fullMessage
      })
    });
    const data = await response.json();
    if (data.ok) {
      console.log('[Immoscout Monitor] Telegram message sent successfully');
    } else {
      console.error('[Immoscout Monitor] Telegram error:', data.description);
    }
  } catch (err) {
    console.error('[Immoscout Monitor] Telegram fetch error:', err.message);
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

  // Send Telegram notification
  sendTelegramMessage(listings);
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
