import { installMbtiConfig } from "./config-install.mjs";

/**
 * Tests call `installMbtiConfig(window, document)` after each `createBrowserEnv`.
 * The browser entry `public/scripts/config.js` uses dynamic import of bootstrap;
 * tests call `installMbtiConfig` from bootstrap directly.
 */
export { installMbtiConfig } from "../../public/scripts/config-bootstrap.mjs";
