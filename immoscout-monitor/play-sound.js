(function () {
  'use strict';

  chrome.storage.local.get('pendingSoundUrl', (result) => {
    const soundUrl = result.pendingSoundUrl;
    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.play().then(() => {
        console.log('[Immoscout Monitor] Sound played');
      }).catch(err => {
        console.error('[Immoscout Monitor] Sound error:', err.message);
      });
    }
  });
})();
