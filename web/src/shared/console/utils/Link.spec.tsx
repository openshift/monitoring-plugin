/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { ExternalLink, LinkifyExternal } from '@/shared/console/utils/Link';

describe('ExternalLink', () => {
  it.each([
    'https://runbooks.example.com/alert',
    'http://runbooks.example.com/alert?severity=high',
  ])('renders an absolute HTTP(S) URL as a link: %s', (href) => {
    render(<ExternalLink href={href} text={href} />);

    expect(screen.getByRole('link', { name: href }).getAttribute('href')).toBe(href);
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
    const { container } = render(<ExternalLink href={href} text={href} />);

    expect(container.textContent).toBe(href);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('LinkifyExternal', () => {
  it('turns URLs in its children into protected external links', () => {
    const href = 'https://runbooks.example.com/alert';
    render(<LinkifyExternal>{href}</LinkifyExternal>);

    const link = screen.getByRole('link', { name: href });
    expect(link.getAttribute('href')).toBe(href);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('prefixes scheme-less URLs with the http protocol', () => {
    render(<LinkifyExternal>See www.runbooks.example.com/alert</LinkifyExternal>);

    const link = screen.getByRole('link', { name: 'www.runbooks.example.com/alert' });
    expect(link.getAttribute('href')).toBe('http://www.runbooks.example.com/alert');
  });

  it.each([
    'file:///etc/passwd',
    'ftp://mirror.example.com/pub',
    'ftps://mirror.example.com/pub',
    'mailto:security@example.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ])('renders an unsafe or non-HTTP(S) URL as text: %s', (url) => {
    const { container } = render(<LinkifyExternal>{`See ${url} for details.`}</LinkifyExternal>);

    expect(container.textContent).toBe(`See ${url} for details.`);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders only the safe links from mixed content', () => {
    render(
      <LinkifyExternal>
        See https://runbooks.example.com/alert or file:///etc/passwd.
      </LinkifyExternal>,
    );

    const link = screen.getByRole('link', { name: 'https://runbooks.example.com/alert' });
    expect(link.getAttribute('href')).toBe('https://runbooks.example.com/alert');
    expect(screen.queryByRole('link', { name: 'file:///etc/passwd' })).toBeNull();
  });
});
