/**
 * Perses Plugin Configuration
 *
 * This module configures global variables needed for Perses plugins to load assets
 * through the OpenShift Console monitoring plugin proxy. The proxy path is injected
 * at build time via webpack DefinePlugin.
 */

// Build-time injected proxy URL for Perses plugins
declare const PERSES_PROXY_BASE_URL: string;

// Configuration object for Perses app compatibility
const PERSES_APP_CONFIG = {
  api_prefix: PERSES_PROXY_BASE_URL,
};

// Set up window globals for plugin system compatibility
// These are needed for plugins that use getPublicPath() in their Module Federation configs
window.PERSES_APP_CONFIG = PERSES_APP_CONFIG;
window.PERSES_PLUGIN_ASSETS_PATH = PERSES_PROXY_BASE_URL;
