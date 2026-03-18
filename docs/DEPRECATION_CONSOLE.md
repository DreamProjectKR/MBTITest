# Chrome DevTools deprecation / Issues (main.js:1)

## What you see

- **Protected Audience API** deprecated
- **Shared Storage API** deprecated
- **StorageType.persistent** deprecated
- Source sometimes shown as **`main.js:1`**

## Root cause

These messages are emitted when **Google’s `gtag.js`** (loaded from `googletagmanager.com`) runs feature detection and ads-related code paths. **They are not caused by `public/scripts/main.js`** (or other app scripts)—there is no use of those APIs in this repo.

Chrome’s Issues panel can point at an unrelated same-page script (e.g. the home `main.js` module).

## What we changed (`public/scripts/analytics.js`)

| Measure                                                                                        | Effect                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **No gtag script on localhost** (`localhost`, `127.0.0.1`, `[::1]`)                            | Local DevTools: those GA-related deprecations should **disappear**.      |
| **`allow_google_signals: false`**, **`allow_ad_personalization_signals: false`** on production | Reduces personalization/ads signal usage where GA4 respects these flags. |
| **`?no_gtag=1`** on any URL                                                                    | Skips loading gtag (useful to confirm Issues vanish when GA is off).     |

## If Issues remain on production (dreamp.org)

Then they still come from **gtag.js** until Google updates the tag. Options:

1. Accept until Google ships a fixed loader.
2. Replace GA with **Cloudflare Web Analytics** (or similar) that does not touch those APIs.
3. Use server-side Measurement Protocol only (no client gtag)—larger change.

## Verification

1. Open `http://localhost:.../index.html` (wrangler pages dev) → Issues tab should **not** list those three for GA.
2. Open `https://dreamp.org/?no_gtag=1` → same (no gtag).
3. Open `https://dreamp.org/` with GA enabled → Issues **may** still appear (third-party).
