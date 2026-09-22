import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('@patternfly/react-core', () => ({
  Button: ({ children, href, rel, target }) => (
    <a href={href} rel={rel} target={target}>
      {children}
    </a>
  ),
  Icon: ({ children }) => <>{children}</>,
}));

jest.mock('@patternfly/react-icons', () => ({
  ExternalLinkAltIcon: () => null,
}));

jest.mock('linkify-react', () => ({ children }) => <>{children}</>);

import { ExternalLink } from './link';

describe('ExternalLink', () => {
  it.each([
    'https://runbooks.example.com/alert',
    'http://runbooks.example.com/alert?severity=high',
  ])('renders an absolute HTTP(S) URL as a link: %s', (href) => {
    const html = renderToStaticMarkup(<ExternalLink href={href} text={href} />);

    expect(html).toContain(`href="${href}"`);
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
    const html = renderToStaticMarkup(<ExternalLink href={href} text={href} />);

    expect(html).not.toMatch(/<a[ >]/);
  });
});
