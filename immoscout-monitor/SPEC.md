# Immoscout New Listing Monitor - Chrome Extension

## Overview
Monitors Immoscout24.de for new apartment listings and notifies the user when matching listings appear.

## How It Works
1. User opens Immoscout with filters already applied and keeps the tab open
2. Extension polls the page every 3 minutes for new listings
3. Filters out "Tauschwohnung" / "Wohnungstausch" listings by title
4. On new listings: plays sound + shows browser notification
5. User clicks notification to view the listing

## Architecture

### Manifest V3 Chrome Extension
- **content.js**: Runs on the Immoscout page, parses listings, handles polling
- **background.js**: Service worker for notifications and sound
- **popup.html/js/css**: Control panel UI
- **storage**: chrome.storage.local for persisting last seen listings

### Data Flow
```
Page (content.js) → Parse listings → Diff against stored IDs → Send to background
                                                                       ↓
                                                              Show notification + play sound
```

## File Structure
```
immoscout-monitor/
├── manifest.json
├── content.js
├── background.js
├── popup.html
├── popup.js
├── popup.css
├── notification.wav    # Notification sound (placeholder)
├── icon.png             # Extension icon (placeholder)
├── message-template.txt # Message template in German
└── SPEC.md
```

## Key Implementation Details

### Listing Detection
Selectors tried in order:
1. `[data-id]`
2. `.result-list__listing`
3. `article.listing-item`
4. `.listing-item`
5. `[class*="listing"]`

Extracts: listing ID, title, link. **Needs verification against actual Immoscout DOM.**

### Tauschwohnung Filter
Excludes listings where title contains (case-insensitive):
- "Tauschwohnung"
- "Wohnungstausch"

### Polling
- `setInterval` in content script, 3 minutes (180000ms)
- On page load, checks immediately once
- On each poll, diffs against stored listing IDs

### Notifications
- Use `chrome.notifications.create()` with:
  - Title: "New Listing Found!"
  - Body: Listing title (+ count if multiple)
  - Icon: extension icon
  - Click: focuses the tab

### Message Template
Located at `message-template.txt` - edit manually to customize the pre-written message.

## Status
- [x] SPEC.md written
- [x] manifest.json created
- [x] content.js created
- [x] background.js created
- [x] popup UI created
- [x] Placeholder icon and sound created
- [ ] **NEEDS: Actual listing selector verification on Immoscout**
- [ ] **NEEDS: Actual Tauschwohnung title pattern confirmation**
- [ ] **NEEDS: User to customize message template**

## Testing
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `immoscout-monitor` folder
4. Go to Immoscout24.de with filters applied
5. Click the extension icon and click "Start Monitoring"
6. Verify the status shows "Monitoring"

## TODO (Before production)
- [ ] Verify listing card selectors match actual Immoscout HTML
- [ ] Confirm Tauschwohnung title patterns
- [ ] Replace placeholder icon.png with proper icon
- [ ] Replace placeholder notification.wav with desired sound
- [ ] Customize message-template.txt
