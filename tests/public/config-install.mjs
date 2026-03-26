import { installMbtiConfig } from "./config-install.mjs";
/**
 * Tests call `installMbtiConfig(window, document)` after each `createBrowserEnv`.
 * The browser entry `public/scripts/config.js` is an ESM shell that runs once when imported;
 * dynamic re-import does not re-execute side effects.
 */
export { installMbtiConfig } from "../../public/scripts/config-bootstrap.mjs";
