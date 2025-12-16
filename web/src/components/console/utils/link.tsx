import type { FC, ReactNode } from 'react';
import Linkify from 'react-linkify';
import { Button, Icon } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

export const ExternalLink: FC<ExternalLinkProps> = ({
  children,
  href,
  text,
  additionalClassName = '',
  dataTestID,
  stopPropagation,
}) => (
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

// Open links in a new window and set noopener/noreferrer.
export const LinkifyExternal: FC<{ children: ReactNode }> = ({ children }) => (
  <Linkify properties={{ target: '_blank', rel: 'noopener noreferrer' }}>{children}</Linkify>
);
LinkifyExternal.displayName = 'LinkifyExternal';

type ExternalLinkProps = {
  href: string;
  text?: ReactNode;
  additionalClassName?: string;
  dataTestID?: string;
  stopPropagation?: boolean;
};
