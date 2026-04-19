let isMonitoring = false;
let newListingCount = 0;

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const lastCheck = document.getElementById('lastCheck');
const newCount = document.getElementById('newCount');
const toggleBtn = document.getElementById('toggleBtn');
const checkNowBtn = document.getElementById('checkNowBtn');
const resetBtn = document.getElementById('resetBtn');

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) return null;
  return chrome.tabs.sendMessage(tab.id, message);
}

async function updateStatus() {
  const response = await sendToContent({ type: 'GET_STATUS' });
  if (response) {
    isMonitoring = response.isMonitoring;
    updateUI();
  }
}

function updateUI() {
  if (isMonitoring) {
    statusDot.classList.add('monitoring');
    statusText.textContent = 'Monitoring';
    toggleBtn.textContent = 'Stop Monitoring';
    toggleBtn.classList.add('stop');
  } else {
    statusDot.classList.remove('monitoring');
    statusText.textContent = 'Idle';
    toggleBtn.textContent = 'Start Monitoring';
    toggleBtn.classList.remove('stop');
  }
  newCount.textContent = `New since reset: ${newListingCount}`;
}

async function toggleMonitoring() {
  if (isMonitoring) {
    await sendToContent({ type: 'STOP' });
  } else {
    await sendToContent({ type: 'START' });
  }
  updateStatus();
}

async function checkNow() {
  await sendToContent({ type: 'CHECK_NOW' });
  lastCheck.textContent = `Last check: ${new Date().toLocaleTimeString()}`;
}

function resetCount() {
  newListingCount = 0;
  chrome.storage.local.set({ newListingCount: 0 });
  updateUI();
}

toggleBtn.addEventListener('click', toggleMonitoring);
checkNowBtn.addEventListener('click', checkNow);
resetBtn.addEventListener('click', resetCount);

document.getElementById('openMessage').addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.newListingCount) {
    newListingCount = changes.newListingCount.newValue || 0;
    updateUI();
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'MONITORING_STARTED') {
    isMonitoring = true;
    updateUI();
  } else if (message.type === 'MONITORING_STOPPED') {
    isMonitoring = false;
    updateUI();
  } else if (message.type === 'NEW_LISTINGS') {
    newListingCount += message.listings.length;
    chrome.storage.local.set({ newListingCount });
    updateUI();
  }
});

updateStatus();
