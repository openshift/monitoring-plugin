/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const { defineConfig } = require('i18next-cli');

module.exports = defineConfig({
  locales: ['en'],
  extract: {
    input: ['src/**/*.{js,jsx,ts,tsx}'],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: 'plugin__monitoring-plugin',
    nsSeparator: '~',
    keySeparator: false,
    // Use the key as the default value (replaces i18next-parser's useKeysAsDefaultValue).
    defaultValue: (key) => key,
  },
});
