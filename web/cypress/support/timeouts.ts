const timeoutConfig = Cypress.config() as unknown as Cypress.ResolvedConfigOptions & {
  installTimeoutMilliseconds: number;
  readyTimeoutMilliseconds: number;
};

export const { installTimeoutMilliseconds, readyTimeoutMilliseconds } = timeoutConfig;
