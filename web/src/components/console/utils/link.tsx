import * as React from 'react';
import Linkify from 'react-linkify';

export const ExternalLink: React.FC<ExternalLinkProps> = ({ href, text }) => (
  <a className="co-external-link" href={href} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);

// Open links in a new window and set noopener/noreferrer.
export const LinkifyExternal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Linkify properties={{ target: '_blank', rel: 'noopener noreferrer' }}>{children}</Linkify>
);

type ExternalLinkProps = {
  href: string;
  text?: React.ReactNode;
};
