declare module '*.svg' {
  const value: any;
  export = value;
}

declare interface Window {
  SERVER_FLAGS: {
    alertManagerBaseURL: string;
    basePath: string;
    prometheusBaseURL: string;
    prometheusTenancyBaseURL: string;
  };
  /**
   * Perses app configuration made available globally for plugin compatibility
   */
  PERSES_APP_CONFIG: {
    api_prefix: string;
  };
  /**
   * Plugin assets path used by module federation for loading plugin assets
   * Set to the same value as the proxy base URL
   */
  PERSES_PLUGIN_ASSETS_PATH: string;
}

// TODO: Remove when upgrading to TypeScript 4.1.2+, which has a type for ListFormat and
//       RelativeTimeFormat.
declare namespace Intl {
  class ListFormat {
    constructor(locales?: Locale | string | undefined, options?: Partial<ListFormatOptions>);
    public format(list?: Iterable<string>): string;
  }
}
