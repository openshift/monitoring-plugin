import type { FC, ReactNode } from 'react';
import Linkify from 'react-linkify';
import { Button, Icon } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

export const ExternalLink: FC<ExternalLinkProps> = ({ href, text }) => {
  if (!isSafeExternalURL(href)) {
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
      href={href}
      target="_blank"
      iconPosition="end"
      rel="noopener noreferrer"
      isInline
    >
      {text}
    </Button>
  );
};

// Open links in a new window and set noopener/noreferrer.
export const LinkifyExternal: FC<{ children: ReactNode }> = ({ children }) => (
  <Linkify properties={{ target: '_blank', rel: 'noopener noreferrer' }}>{children}</Linkify>
);
LinkifyExternal.displayName = 'LinkifyExternal';

type ExternalLinkProps = {
  href: string;
  text?: ReactNode;
};

const isSafeExternalURL = (value: string): value is string => {
  if (!URL.canParse(value)) {
    return false;
  }

  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
};
