# Household Tracker

Two simple iPhone-friendly web apps sharing one Google Sheet:

- `hydration-app/` — daily water tracking for You and Wife.
- `household-app/` — diaper changes and cat-bowl refills/full changes.
- `apps-script/Code.gs` — the Google Sheets backend and NFC endpoints.

## What this version does

- Logs events to timestamped rows in Google Sheets.
- Shows today's hydration totals against the 100 oz / 80 oz goals.
- Uses your 24 oz and your wife's 32 oz bottle sizes for NFC bottle taps.
- Supports manual logging in both apps.
- Lets NFC stickers log diaper changes, cat refills, cat full changes, and bottle fills.
- Uses one shared private app link key. No Google sign-in, Firebase, or separate user accounts.
- Ignores repeat taps on the same NFC sticker within an 8-second window to reduce accidental duplicate entries.

## Setup

### 1. Create the Google Sheet

1. Create a blank Google Sheet named `Household Tracker`.
2. Open **Extensions → Apps Script**.
3. Replace the editor contents with `apps-script/Code.gs` and save.
4. In **Project Settings**, set the time zone to **America/Chicago**.
5. Run `setup()` once from the Apps Script editor and approve the permissions. This creates the log and settings tabs.

### 2. Add Script Properties

In Apps Script → **Project Settings → Script Properties**, add these properties:

| Property | Value |
|---|---:|
| `APP_ACCESS_KEY` | A long random secret you create |
| `DIAPER_STICKER_KEY` | A different long random secret |
| `CAT_REFILL_STICKER_KEY` | A different long random secret |
| `CAT_CHANGE_STICKER_KEY` | A different long random secret |
| `YOU_BOTTLE_STICKER_KEY` | A different long random secret |
| `WIFE_BOTTLE_STICKER_KEY` | A different long random secret |
| `YOUR_BOTTLE_OZ` | `24` |
| `WIFE_BOTTLE_OZ` | `32` |

Use a password manager to generate the secrets. Do not put them in the Apps Script source code.

### 3. Deploy the backend

1. Click **Deploy → New deployment → Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
3. Deploy and copy the Web App URL ending in `/exec`.
4. Open `<WEB_APP_URL>?action=health` once. You should see an API-running message.

The web app must be reachable without Google sign-in so your wife's iPhone and NFC stickers can use it. The secret keys are the access control. This is a lightweight shared-link arrangement: anyone who has the private app link can view and add records, and anyone who has an NFC sticker link can trigger that sticker's action. It is not individual-user authentication.

### 4. Publish the two apps

1. In both `hydration-app/config.js` and `household-app/config.js`, replace the placeholder with your Apps Script Web App URL.
2. Upload the project folders to a GitHub repository and enable GitHub Pages over HTTPS. The app source contains no secret keys.
3. Your app links will look like this (replace the placeholders):

   - `https://YOUR_GITHUB_PAGES_URL/hydration-app/#key=YOUR_APP_ACCESS_KEY`
   - `https://YOUR_GITHUB_PAGES_URL/household-app/#key=YOUR_APP_ACCESS_KEY`

4. Open each link on both iPhones. On iPhone, use **Share → Add to Home Screen**. Send your wife the same private links.

**Keep the app links private.** The key after `#key=` is not published in the GitHub source, but anyone who receives the full link can use the app to view and add household records. This is a simple shared-link setup, not individual accounts. If a link is shared accidentally, change `APP_ACCESS_KEY` in Script Properties and update the links.

### 5. Program the NFC stickers

Write these URLs to the NTAG215 stickers using an NFC-writing app:

`<WEB_APP_URL>?action=scan&token=<STICKER_KEY>`

| Sticker | Script Property |
|---|---|
| Diaper station | `DIAPER_STICKER_KEY` |
| Cat partial refill | `CAT_REFILL_STICKER_KEY` |
| Cat full water change | `CAT_CHANGE_STICKER_KEY` |
| Your bottle | `YOU_BOTTLE_STICKER_KEY` |
| Wife's bottle | `WIFE_BOTTLE_STICKER_KEY` |

Tap each sticker once and confirm the corresponding row appears in the Google Sheet. Repeating the same sticker tap within 8 seconds will be ignored as a likely accidental duplicate.

## Notes

- The spreadsheet is owned by your Google account; your wife does not need access to it.
- Anyone with an NFC sticker URL can trigger that sticker's action. Keep those URLs private too.
- This is designed as a lightweight personal tracker, not a high-security system.
- The Apps Script and Sheets free quotas apply. Internet is required for logging and refreshing.
- If you change a setting in the `Settings` tab, the dashboard reads the updated goal/bottle values.
