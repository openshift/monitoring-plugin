/**
 * Perses global setup: proxy-path window globals and host shared-module
 * registration. Imported for side effects at the top of `PersesWrapper`.
 */

import * as PersesClient from '@perses-dev/client';
import * as PersesComponents from '@perses-dev/components';
import * as PersesDashboards from '@perses-dev/dashboards';
import * as PersesExplore from '@perses-dev/explore';
import { registerHostSharedModules } from '@perses-dev/plugin-system';
import * as PersesPluginSystem from '@perses-dev/plugin-system';
import * as PersesSpec from '@perses-dev/spec';

// Perses 0.55+ requires the host to register its @perses-dev packages before
// remote plugins (loaded via PluginRegistry) can consume them.
registerHostSharedModules({
  '@perses-dev/spec': PersesSpec,
  '@perses-dev/client': PersesClient,
  '@perses-dev/components': PersesComponents,
  '@perses-dev/plugin-system': PersesPluginSystem,
  '@perses-dev/explore': PersesExplore,
  '@perses-dev/dashboards': PersesDashboards,
});

// Proxy URL injected at build time via webpack DefinePlugin.
declare const PERSES_PROXY_BASE_URL: string;

// Window globals read by Perses plugins' getPublicPath() in their MF configs.
window.PERSES_APP_CONFIG = { api_prefix: PERSES_PROXY_BASE_URL };
window.PERSES_PLUGIN_ASSETS_PATH = PERSES_PROXY_BASE_URL;
