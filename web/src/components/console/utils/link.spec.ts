import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('@patternfly/react-core', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    Button: ({
      children,
      href,
      rel,
      target,
    }: {
      children: React.ReactNode;
      href: string;
      rel: string;
      target: string;
    }) => React.createElement('a', { href, rel, target }, children),
    Icon: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('@patternfly/react-icons', () => ({
  ExternalLinkAltIcon: () => null,
}));
jest.mock('linkify-react', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import { ExternalLink } from './link';

const renderExternalLink = (href: string): string =>
  renderToStaticMarkup(React.createElement(ExternalLink, { href, text: href }));

describe('ExternalLink', () => {
  it.each([
    'https://runbooks.example.com/alert',
    'http://runbooks.example.com/alert?severity=high',
  ])('renders an absolute HTTP(S) URL as a link: %s', (href) => {
    const markup = renderExternalLink(href);

    expect(markup).toContain(`href="${href.replace('&', '&amp;')}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
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
  ])('renders an unsafe or invalid URL as text: %s', (href) => {
    const markup = renderExternalLink(href);

    expect(markup).not.toContain('<a');
    expect(markup).not.toContain('href=');
    expect(markup).not.toBe('');
  });
});
