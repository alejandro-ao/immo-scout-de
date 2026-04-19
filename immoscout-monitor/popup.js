let isMonitoring = false;
let newListingCount = 0;

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const lastCheck = document.getElementById('lastCheck');
const newCount = document.getElementById('newCount');
const toggleBtn = document.getElementById('toggleBtn');
const checkNowBtn = document.getElementById('checkNowBtn');
const resetBtn = document.getElementById('resetBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsSection = document.getElementById('settingsSection');
const saveSettingsBtn = document.getElementById('saveSettings');

const refreshRateInput = document.getElementById('refreshRate');
const refreshValue = document.getElementById('refreshValue');
const messageTemplateInput = document.getElementById('messageTemplate');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const addressInput = document.getElementById('address');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const monthlyIncomeInput = document.getElementById('monthlyIncome');
const birthYearInput = document.getElementById('birthYear');
const occupationInput = document.getElementById('occupation');

const DEFAULT_SETTINGS = {
  refreshRate: 180,
  messageTemplate: `Sehr geehrte/r Eigentümer/in,

ich habe Ihre Anzeige auf Immoscout24 gesehen und bin sehr interessiert.

Ich würde mich freuen, wenn Sie mir weitere Informationen zur Wohnung zukommen lassen könnten. Gerne sende ich Ihnen meine vollständigen Bewerbungsunterlagen zu.

Bitte lassen Sie mich wissen, wann eine Besichtigung möglich wäre.

Mit freundlichen Grüßen`,
  firstName: '',
  lastName: '',
  address: '',
  email: '',
  phone: '',
  monthlyIncome: '',
  birthYear: '',
  occupation: '',
  numberOfAdults: '1',
  numberOfKids: '0',
  hasPets: '',
  salutation: '',
  telegramBotToken: '',
  telegramChatId: ''
};

const SETTINGS_KEY = 'userSettings';

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isImmoscoutTab(tab) {
  return Boolean(tab?.url && /^https?:\/\/([^.]+\.)?immobilienscout24\.de\//.test(tab.url));
}

async function sendToContent(message) {
  try {
    const tab = await getCurrentTab();
    if (!tab || !tab.id) return null;
    if (!isImmoscoutTab(tab)) return null;
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Content script not ready:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    });
  } catch (e) {
    console.warn('Content script error:', e.message);
    return null;
  }
}

async function updateStatus() {
  const tab = await getCurrentTab();
  if (!isImmoscoutTab(tab)) {
    isMonitoring = false;
    statusDot.classList.remove('monitoring');
    statusText.textContent = 'Open an ImmoScout24 tab';
    toggleBtn.textContent = 'Start Monitoring';
    toggleBtn.classList.remove('stop');
    return;
  }

  const response = await sendToContent({ type: 'GET_STATUS' });
  if (response !== null) {
    isMonitoring = response.isMonitoring;
  }
  updateUI();
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
  const tab = await getCurrentTab();
  if (!isImmoscoutTab(tab)) {
    lastCheck.textContent = 'Last check: Open an ImmoScout24 listing page first';
    return;
  }

  if (isMonitoring) {
    await sendToContent({ type: 'STOP' });
  } else {
    const settings = await loadSettings();
    await sendToContent({ type: 'START', refreshRate: settings.refreshRate });
  }
  updateStatus();
}

async function checkNow() {
  const response = await sendToContent({ type: 'CHECK_NOW' });
  if (response === null) {
    lastCheck.textContent = 'Last check: Open an ImmoScout24 listing page first';
    return;
  }
  lastCheck.textContent = `Last check: ${new Date().toLocaleTimeString()}`;
}

function resetCount() {
  newListingCount = 0;
  chrome.storage.local.set({ newListingCount: 0 });
  updateUI();
}

function toggleSettings() {
  const isVisible = settingsSection.style.display !== 'none';
  settingsSection.style.display = isVisible ? 'none' : 'block';
}

function formatRefreshValue(seconds) {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(SETTINGS_KEY, result => {
      const settings = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
      resolve(settings);
    });
  });
}

async function loadSettingsIntoForm() {
  const settings = await loadSettings();

  refreshRateInput.value = settings.refreshRate;
  refreshValue.textContent = formatRefreshValue(settings.refreshRate);
  messageTemplateInput.value = settings.messageTemplate;
  firstNameInput.value = settings.firstName;
  lastNameInput.value = settings.lastName;
  addressInput.value = settings.address;
  emailInput.value = settings.email;
  phoneInput.value = settings.phone;
  monthlyIncomeInput.value = settings.monthlyIncome;
  birthYearInput.value = settings.birthYear;
  occupationInput.value = settings.occupation;
  document.getElementById('numberOfAdults').value = settings.numberOfAdults || '1';
  document.getElementById('numberOfKids').value = settings.numberOfKids || '0';
  document.getElementById('hasPets').value = settings.hasPets || '';
  document.getElementById('salutation').value = settings.salutation || '';
  document.getElementById('telegramBotToken').value = settings.telegramBotToken || '';
  document.getElementById('telegramChatId').value = settings.telegramChatId || '';
}

async function saveSettings() {
  const settings = {
    refreshRate: parseInt(refreshRateInput.value, 10),
    messageTemplate: messageTemplateInput.value,
    firstName: firstNameInput.value,
    lastName: lastNameInput.value,
    address: addressInput.value,
    email: emailInput.value,
    phone: phoneInput.value,
    monthlyIncome: monthlyIncomeInput.value,
    birthYear: birthYearInput.value,
    occupation: occupationInput.value,
    numberOfAdults: document.getElementById('numberOfAdults').value,
    numberOfKids: document.getElementById('numberOfKids').value,
    hasPets: document.getElementById('hasPets').value,
    salutation: document.getElementById('salutation').value,
    telegramBotToken: document.getElementById('telegramBotToken').value,
    telegramChatId: document.getElementById('telegramChatId').value
  };

  return new Promise(resolve => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
      resolve();
    });
  });
}

toggleBtn.addEventListener('click', toggleMonitoring);
checkNowBtn.addEventListener('click', checkNow);
resetBtn.addEventListener('click', resetCount);

document.getElementById('testNotificationBtn').addEventListener('click', () => {
  sendToContent({ type: 'TEST_NOTIFICATION' });
});

document.getElementById('autoFillBtn').addEventListener('click', async () => {
  const settings = await loadSettings();
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'AUTO_FILL_FORM',
        settings
      });
    }
  });
});

document.getElementById('testTelegramBtn').addEventListener('click', async () => {
  const botToken = document.getElementById('telegramBotToken').value.trim();
  const chatId = document.getElementById('telegramChatId').value.trim();

  if (!botToken || !chatId) {
    alert('Please enter both Telegram Bot Token and Chat ID');
    return;
  }

  const btn = document.getElementById('testTelegramBtn');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  const testMessage = `[TEST] Immoscout Monitor is working! Time: ${new Date().toLocaleTimeString()}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage
      })
    });
    const data = await response.json();
    if (data.ok) {
      btn.textContent = 'Sent!';
    } else {
      btn.textContent = 'Failed: ' + (data.description || 'Unknown error');
    }
  } catch (err) {
    btn.textContent = 'Error: ' + err.message;
  }

  setTimeout(() => {
    btn.textContent = 'Test Telegram';
    btn.disabled = false;
  }, 3000);
});

settingsBtn.addEventListener('click', toggleSettings);

document.getElementById('telegramHelp').addEventListener('click', e => {
  e.preventDefault();
  alert('Telegram Setup:\n\n1. Open Telegram and search @BotFather\n2. Send /newbot and follow prompts\n3. Copy the bot token\n4. Search your new bot and send it a message\n5. Go to @userinfobot to get your Chat ID\n6. Enter both below and click Test Telegram');
});

refreshRateInput.addEventListener('input', () => {
  refreshValue.textContent = formatRefreshValue(parseInt(refreshRateInput.value, 10));
});

saveSettingsBtn.addEventListener('click', async () => {
  await saveSettings();
  saveSettingsBtn.textContent = 'Saved!';
  setTimeout(() => {
    saveSettingsBtn.textContent = 'Save Settings';
  }, 1500);

  if (isMonitoring) {
    const settings = await loadSettings();
    await sendToContent({ type: 'UPDATE_REFRESH_RATE', refreshRate: settings.refreshRate });
  }
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

loadSettingsIntoForm();
updateStatus();
