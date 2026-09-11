// Globally mock the SDK: pass through the real `common-types` and supply the
// runtime values for the SDK's `const enum`s
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
}));

// types present in src/index.d.ts,
const SERVER_FLAGS: Window['SERVER_FLAGS'] = {
  alertManagerBaseURL: '/api/alertmanager',
  basePath: '/',
  prometheusBaseURL: '/api/prometheus',
  prometheusTenancyBaseURL: '/api/prometheus-tenancy',
};

// In the jsdom environment a real `window` already exists (needed by React DOM),
// so only attach SERVER_FLAGS to it. In the node environment there is no window,
// so create a minimal stub.
if (typeof window === 'undefined') {
  global.window = { SERVER_FLAGS } as Window & typeof globalThis;
} else {
  window.SERVER_FLAGS = SERVER_FLAGS;
}
