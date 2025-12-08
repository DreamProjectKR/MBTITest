(function () {
  const DEFAULT_ASSETS_BASE =
    'https://pub-9394623df95a4f669f145a4ede63d588.r2.dev';
  const DEFAULT_API_TESTS_BASE = '/api/tests';

  const ASSETS_BASE = window.ASSETS_BASE || DEFAULT_ASSETS_BASE;
  const API_TESTS_BASE = window.API_TESTS_BASE || DEFAULT_API_TESTS_BASE;

  window.ASSETS_BASE = ASSETS_BASE;
  window.API_TESTS_BASE = API_TESTS_BASE;

  window.assetUrl = function assetUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const clean = path.replace(/^\.?\/+/, '');
    const prefixed = clean.startsWith('assets/') ? clean : `assets/${clean}`;
    return `${ASSETS_BASE}/${prefixed}`;
  };
})();
