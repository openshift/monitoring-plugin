import * as React from 'react';
import Linkify from 'react-linkify';
import { Button, Icon } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

export const ExternalLink: React.FC<ExternalLinkProps> = ({
  children,
  href,
  text,
  additionalClassName = '',
  dataTestID,
  stopPropagation,
}) => {
  if (!isSafeExternalURL(href)) {
    return <>{children || text}</>;
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
      className={additionalClassName}
      href={href}
      target="_blank"
      iconPosition="end"
      rel="noopener noreferrer"
      data-test-id={dataTestID}
      {...(stopPropagation ? { onClick: (e) => e.stopPropagation() } : {})}
      isInline
    >
      {children || text}
    </Button>
  );
};

// Open links in a new window and set noopener/noreferrer.
export const LinkifyExternal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Linkify properties={{ target: '_blank', rel: 'noopener noreferrer' }}>{children}</Linkify>
);
LinkifyExternal.displayName = 'LinkifyExternal';

type ExternalLinkProps = {
  href: string;
  text?: React.ReactNode;
  additionalClassName?: string;
  dataTestID?: string;
  stopPropagation?: boolean;
};

const isSafeExternalURL = (value: string): value is string => {
  if (!URL.canParse(value)) {
    return false;
  }

  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
};
