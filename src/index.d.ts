declare module '*.svg' {
  const value: any;
  export = value;
}

declare interface Window {
  SERVER_FLAGS: {
    alertManagerBaseURL: string;
    basePath: string;
    prometheusBaseURL: string;
  };
}

// TODO: Remove when upgrading to TypeScript 4.1.2+, which has a type for ListFormat and
//       RelativeTimeFormat.
declare namespace Intl {
  class ListFormat {
    constructor(locales?: Locale | string | undefined, options?: Partial<ListFormatOptions>);
    public format(list?: Iterable<string>): string;
  }
}
