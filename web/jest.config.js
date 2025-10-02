/* eslint-disable no-undef */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx)$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
      },
    }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@openshift-console|@patternfly|lodash-es)/)'],
};
