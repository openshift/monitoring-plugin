jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

Object.defineProperty(global, 'window', {
  value: {
    SERVER_FLAGS: {
      prometheusBaseURL: '',
      prometheusTenancyBaseURL: '',
      alertManagerBaseURL: '',
    },
  },
});

import { getSafeExternalURL } from './utils';

describe('getSafeExternalURL', () => {
  it('returns undefined when no URL is provided', () => {
    expect(getSafeExternalURL()).toBeUndefined();
  });

  it.each([
    'https://runbooks.example.com/alert',
    'http://runbooks.example.com/alert?severity=high',
  ])('returns a valid HTTP(S) URL unchanged: %s', (url) => {
    expect(getSafeExternalURL(url)).toBe(url);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'mailto:security@example.com',
    '/runbooks/alert',
    '//runbooks.example.com/alert',
    '\tjavascript:alert(1)',
    'not a URL',
  ])('rejects an unsafe or invalid URL: %s', (url) => {
    expect(getSafeExternalURL(url)).toBeUndefined();
  });
});
