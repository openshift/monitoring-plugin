import { defineConfig } from 'orval';

import { namedQueryParameters } from './src/shared/clients/alert-management-api/named-query-parameters';

export default defineConfig({
  alertManagement: {
    hooks: {
      afterAllFilesWrite: ['eslint --fix', 'prettier --write'],
    },
    input: '../api/openapi.yaml',
    output: {
      target: './src/shared/clients/alert-management-api/generated/api.ts',
      client: (clients) => ({
        ...clients['react-query'],
        client: async (...args) => {
          const result = await clients['react-query'].client(...args);
          return {
            ...result,
            implementation: namedQueryParameters(result.implementation),
          };
        },
      }),
      httpClient: 'fetch',
      // base url and fetch are configured in transport.ts
      baseUrl: '',
      clean: true,
      tsconfig: './tsconfig.json',
      urlEncodeParameters: true,
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: '@/shared/clients/alert-management-api/transport',
          name: 'alertManagementFetch',
        },
        query: {
          version: 4,
          signal: true,
          mutationOptions: {
            path: '@/shared/clients/alert-management-api/mutation-options',
            name: 'alertManagementMutationOptions',
          },
        },
      },
    },
  },
});
