/**
 * Browser entry for MBTI asset helpers. Uses dynamic `import()` only (no static
 * `import`), so this file runs correctly as a classic script when `type="module"`
 * is missing from the `<script>` tag (broken proxies, stale HTML, or minifiers).
 */
void import("./config-bootstrap.mjs")
  .then(function (mod) {
    mod.installMbtiConfig(window, document);
  })
  .catch(function (err) {
    console.error("MBTI config failed to load:", err);
  });
