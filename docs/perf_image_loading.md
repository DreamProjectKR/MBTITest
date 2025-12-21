# Image Loading Performance Notes

## What Changed

This repo uses a same-origin asset proxy (`GET /assets/*`) via Pages Functions so the browser can load images from `dreamp.org` without CORS issues.

To reduce perceived image latency:

- Frontend builds asset URLs as same-origin `/assets/...` by default (served by the proxy from R2).
- The intro page's `thumbnail.png` and `author.png` are marked as **high priority** (best-effort `fetchpriority`/`loading`/`decoding` hints).
- The list page's first card thumbnail is also marked as **high priority** (likely above the fold).
- The proxy sets cache headers and uses `caches.default` (edge cache) to reduce repeat TTFB.
  - Response headers include `X-MBTI-Assets-Proxy: 1` and `X-MBTI-R2-Key: ...` for debugging.

## Where The Changes Live

- `public/scripts/config.js`
  - Default `ASSETS_BASE` is empty string, so `window.assetUrl("assets/...")` becomes `/assets/...` (same-origin).
- `public/styles/main.css`
  - `:root` default background-image variables use `/assets/...` so initial render stays same-origin.
- `public/index.html`
  - Preloads for `mainLogo.png` and `mainbanner.png` use `/assets/...` (same-origin).
- `functions/assets/[[path]].js`
  - Reads R2 objects via `MBTI_BUCKET` binding and serves them under `/assets/*`.
- `public/scripts/testintro.js`
  - Adds a small helper (`markHighPriorityImage`) and applies it to the intro thumbnail and author image.
- `public/scripts/testlist.js`
  - Applies high-priority hints to the first rendered thumbnail image.

## Notes

- You can still bypass the proxy for debugging by setting `window.ASSETS_BASE = "https://pub-...r2.dev"` before `config.js` loads, but you must configure R2 CORS to allow `https://dreamp.org`.

## How To Verify

In Chrome DevTools:

1. Open the **Network** tab, filter by `Img`.
2. Load `testintro.html?testId=...`.
3. Confirm the `thumbnail.png` and `author.png` requests:
   - Request URL host is your site origin (`https://dreamp.org`) and paths start with `/assets/`.
   - Response headers include `X-MBTI-Assets-Proxy: 1`.
   - On repeat loads, you should see edge caching behavior (varies by browser/edge); you can compare TTFB and confirm Cache-Control includes SWR/SIE.
   - Priority is higher than other images (browser-dependent).

If you see requests going directly to `pub-...r2.dev` in production, it means something is bypassing the proxy and you may hit CORS depending on R2 settings.

## Override Lever (Bypass Proxy)

If you ever need to temporarily bypass same-origin asset loading, you can set `window.ASSETS_BASE` to a full public base URL *before* `scripts/config.js` runs (e.g., inline in the `<head>`):

```html
<script>
  window.ASSETS_BASE = "https://pub-...r2.dev";
</script>
<script src="./scripts/config.js" defer></script>
```

That makes `window.assetUrl("assets/...")` resolve to `https://pub-...r2.dev/assets/...` (direct cross-origin loads).
