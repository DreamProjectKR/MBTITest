# Image Loading Performance Notes

## What Changed

This repo supports a same-origin asset proxy (`GET /assets/*`) via Pages Functions. This avoids CORS issues when loading images from R2 in production.

To reduce image TTFB and improve perceived performance:

- Frontend builds **same-origin `/assets/...` URLs** by default, so the browser requests `https://dreamp.org/assets/...` and the proxy fetches from R2 using the binding.
- The intro page's `thumbnail.png` and `author.png` are marked as **high priority** (best-effort `fetchpriority`/`loading`/`decoding` hints).
- The list page's first card thumbnail is also marked as **high priority** (likely above the fold).
## Notes

- Avoid using the `pub-...r2.dev` URL directly in production pages. That host is convenient for development, but it can trigger CORS restrictions depending on your R2 CORS configuration and browser behavior.

## Where The Changes Live

- `public/scripts/config.js`
  - Default `ASSETS_BASE` is now the public R2 base (`r2.dev`), so `window.assetUrl("assets/...")` becomes `https://<r2-public-base>/assets/...`.
- `public/styles/main.css`
  - `:root` default background-image variables use the public R2 origin to avoid early `/assets/...` proxy fetches before JS runs.
- `public/index.html`
  - Preloads for `mainLogo.png` and `mainbanner.png` use absolute R2 URLs and add `preconnect`/`dns-prefetch` for the R2 origin.
- `public/testintro.html`, `public/testlist.html`, `public/testquiz.html`, `public/testresult.html`
  - Add `preconnect`/`dns-prefetch` for the R2 origin.
- `public/scripts/testintro.js`
  - Adds a small helper (`markHighPriorityImage`) and applies it to the intro thumbnail and author image.
- `public/scripts/testlist.js`
  - Applies high-priority hints to the first rendered thumbnail image.

## Notes

- The asset proxy (`/assets/*`) is part of this project and is the default production path to avoid CORS.

## How To Verify

In Chrome DevTools:

1. Open the **Network** tab, filter by `Img`.
2. Load `testintro.html?testId=...`.
3. Confirm the `thumbnail.png` and `author.png` requests:
   - Request URL host is the public R2 base (e.g. `pub-...r2.dev`), not your site origin.
   - Priority is higher than other images (browser-dependent).

If you see `/assets/...` being requested from your site origin, that is expected (same-origin proxy path).

## Rollback Lever (Reintroduce Proxy)

If you ever need to temporarily force same-origin asset loading (proxy mode), you can set `window.ASSETS_BASE` to your own origin *before* `scripts/config.js` runs (e.g., inline in the `<head>`):

```html
<script>
  window.ASSETS_BASE = window.location.origin;
</script>
<script src="./scripts/config.js" defer></script>
```

That makes `window.assetUrl("assets/...")` resolve to `https://<your-site>/assets/...`. For it to work, you must reintroduce `/assets/*` routing and an asset proxy function.
