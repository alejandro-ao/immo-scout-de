(function () {
  'use strict';

  let currentAudio = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'PLAY_NOTIFICATION_SOUND') {
      return false;
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      currentAudio = new Audio(chrome.runtime.getURL('notification.mp3'));
      currentAudio.preload = 'auto';
      currentAudio.play().then(() => {
        console.log('[Immoscout Monitor] Sound played from offscreen document');
        sendResponse({ success: true });
      }).catch(err => {
        console.error('[Immoscout Monitor] Sound error:', err.message);
        sendResponse({ success: false, error: err.message });
      });
    } catch (err) {
      console.error('[Immoscout Monitor] Sound setup error:', err.message);
      sendResponse({ success: false, error: err.message });
    }

    return true;
  });
})();
