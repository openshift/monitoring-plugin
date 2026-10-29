import { Button, Icon } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import Linkify from 'linkify-react';
import type { FC, ReactNode } from 'react';

export const ExternalLink: FC<ExternalLinkProps> = ({ href, text }) => {
  const safeHref = toSafeExternalURL(href);
  if (!safeHref) {
    return <>{text}</>;
  }

  return (
    <Button
      variant="link"
      component="a"
      icon={
        <Icon size="sm">
          <ExternalLinkAltIcon />
        </Icon>
      }
      href={safeHref}
      target="_blank"
      iconPosition="end"
      rel="noopener noreferrer"
      isInline
    >
      {text}
    </Button>
  );
};

// Open links in a new window and set noopener/noreferrer. HTTP(S) URLs and scheme-less
// URLs (assumed https://) become links; URLs with any other scheme render as text.
export const LinkifyExternal: FC<{ children: ReactNode }> = ({ children }) => (
  <Linkify
    options={{
      // Scheme-less URLs (e.g. www.example.com) are linkified as https://
      defaultProtocol: 'https',
      target: '_blank',
      rel: 'noopener noreferrer',
      render: ({ attributes, content }) => {
        const safeHref = toSafeExternalURL(attributes.href);
        return safeHref ? (
          <a {...attributes} href={safeHref}>
            {content}
          </a>
        ) : (
          <>{content}</>
        );
      },
    }}
  >
    {children}
  </Linkify>
);
LinkifyExternal.displayName = 'LinkifyExternal';

type ExternalLinkProps = {
  href: string;
  text?: ReactNode;
};

// Returns an HTTP(S) href — assuming https for scheme-less values — or null if the value is unsafe
const toSafeExternalURL = (value: string): string | null => {
  let url: URL | null = null;
  if (URL.canParse(value)) {
    url = new URL(value);
    // runbooks.example.com:8443/guide parses as scheme + opaque path; a dotted
    // "scheme" is a hostname:port, so drop it and retry as scheme-less below.
    if (!url.hostname && url.protocol.includes('.')) {
      url = null;
    }
  }
  if (!url && !/^[/?#]/.test(value) && URL.canParse(`https://${value}`)) {
    // Scheme-less value such as www.example.com/runbook. Relative references
    // (/path, //host/path, ?query, #fragment) are not external URLs.
    url = new URL(`https://${value}`);
  }
  if (url?.hostname && (url.protocol === 'http:' || url.protocol === 'https:')) {
    return url.href;
  }
  return null;
};
