# Image Loading Performance Notes

## What Changed

This repo originally supported a same-origin asset proxy (`GET /assets/*`) via Pages Functions. That avoids CORS/CORP issues, but it can add latency because every image request pays the Functions hop.

To reduce image TTFB and improve perceived performance:

- Frontend now builds **absolute public R2 URLs** (the `r2.dev` public endpoint) for assets by default (so images bypass the `/assets/*` proxy).
- The intro page's `thumbnail.png` and `author.png` are marked as **high priority** (best-effort `fetchpriority`/`loading`/`decoding` hints).
- The list page's first card thumbnail is also marked as **high priority** (likely above the fold).
- The `/assets/*` proxy was removed (files + routing) after switching all asset loads to absolute public R2 URLs.

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

- The asset proxy (`/assets/*`) is no longer part of this project. Any URLs under `https://dreamp.org/assets/...` must be updated to use the public R2 base.

## How To Verify

In Chrome DevTools:

1. Open the **Network** tab, filter by `Img`.
2. Load `testintro.html?testId=...`.
3. Confirm the `thumbnail.png` and `author.png` requests:
   - Request URL host is the public R2 base (e.g. `pub-...r2.dev`), not your site origin.
   - Priority is higher than other images (browser-dependent).

If you still see `/assets/...` being requested from your site origin, it will now 404 unless you reintroduce the proxy.

## Rollback Lever (Reintroduce Proxy)

If you ever need to temporarily force same-origin asset loading (proxy mode), you can set `window.ASSETS_BASE` to your own origin *before* `scripts/config.js` runs (e.g., inline in the `<head>`):

```html
<script>
  window.ASSETS_BASE = window.location.origin;
</script>
<script src="./scripts/config.js" defer></script>
```

That makes `window.assetUrl("assets/...")` resolve to `https://<your-site>/assets/...`. For it to work, you must reintroduce `/assets/*` routing and an asset proxy function.
