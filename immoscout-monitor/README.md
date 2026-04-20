# Immoscout Monitor

A Chrome extension that monitors Immoscout24.de for new apartment listings and notifies you via Telegram when matching listings appear.

## Features

- **Auto-refresh**: Periodically fetches new listings (configurable 30 sec - 10 min)
- **Tauschwohnung filter**: Automatically ignores "Wohnungstausch" and "Tauschwohnung" listings
- **Telegram notifications**: Get instant alerts when new listings appear
- **Auto-fill forms**: Fill contact forms with your saved profile data in one click
- **Tab highlighting**: Visual notification when you're on another tab
- **Badge counter**: Shows number of new listings on the extension icon

## Setup

### 1. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `immoscout-monitor` folder

### 2. Configure Telegram Bot (for notifications)

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts (give it a name and username)
3. Copy the **bot token** (looks like `123456789:ABCdef...`)
4. Search for your new bot by its username and send it a message
5. Go to **@userinfobot** or **@getidsbot** to get your **Chat ID** (a number like `123456789`)
6. In the extension, click the **⚙ Settings** button
7. Enter your Telegram Bot Token and Chat ID
8. Click **Test Telegram** to verify it works

### 3. Configure Your Profile

In Settings, fill in your profile information:
- **Salutation**: Mister / Woman / Company
- **First Name / Last Name**
- **Street, Postal Code, City, Country**
- **Email / Phone**
- **Monthly Income**
- **Adults / Children / Pets**
- **Occupation**

This data will be used to auto-fill contact forms.

### 4. Apply Filters on Immoscout

Before starting monitoring:
1. Go to [immobilienscout24.de](https://www.immobilienscout24.de)
2. Apply your desired filters (price, location, size, etc.)
3. Keep this tab open

### 5. Start Monitoring

1. Click the **Immoscout Monitor** extension icon
2. Click **Start Monitoring**
3. The extension will check for new listings every 3 minutes (configurable in settings)

## Usage

### Main Controls

- **Start Monitoring** / **Stop Monitoring**: Toggle monitoring on/off
- **Check Now**: Immediately check for new listings
- **Reset Count**: Reset the new listing counter
- **Test Notification**: Simulate a new listing notification
- **Auto-fill Form**: Fill the contact form on the current listing page with your saved profile

### Settings

Click the **⚙** button to access settings:
- **Refresh Rate**: How often to check for new listings (30 sec - 10 min)
- **Message Template**: The message to send to landlords (German template included)
- **Profile**: Your personal information for auto-fill
- **Telegram**: Bot token and chat ID for notifications

## How It Works

1. The extension fetches the page HTML at your configured interval
2. Listings are identified by `data-id` attributes and content hash
3. New listings are filtered (Tauschwohnung ignored) and compared against stored IDs
4. When new listings are found:
   - Browser notification appears
   - Telegram message is sent (if configured)
   - Tab badge shows count
   - Extension icon pulses

## File Structure

```
immoscout-monitor/
├── manifest.json      # Chrome extension manifest
├── background.js      # Service worker (notifications, Telegram)
├── content.js        # Content script (fetching, auto-fill)
├── popup.html        # Extension popup UI
├── popup.js          # Popup logic
├── popup.css         # Popup styling
├── notification.mp3  # Notification sound (fallback)
├── icon.png          # Extension icon
└── message-template.txt  # Default message template
```

## Requirements

- Chrome browser (Manifest V3)
- Immoscout24.de account (you must be logged in)
- Telegram bot (optional, for notifications)

## Limitations

- The tab must remain open for monitoring to work
- Chrome may throttle background tabs if inactive for long periods
- Some anti-bot measures may trigger on frequent fetches (use 3+ min intervals)
- Email field cannot be auto-filled (Immoscout restriction)

## Troubleshooting

**Not seeing new listings?**
- Check the browser console (Cmd+Option+I) on the Immoscout tab for logs
- Verify you're on the correct Immoscout domain (immobilienscout24.de vs immoscout24.de)

**Telegram not working?**
- Make sure you clicked "Save Settings" after entering Telegram credentials
- Test with the "Test Telegram" button first

**Auto-fill not working?**
- Make sure the contact form modal is open before clicking "Auto-fill Form"
- Check browser console for errors

## License

MIT
