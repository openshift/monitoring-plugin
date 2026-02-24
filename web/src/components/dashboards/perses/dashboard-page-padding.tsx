import * as React from 'react';

interface PagePaddingProps {
  children: React.ReactNode;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

const PF_SPACER_SM = 'var(--pf-v5-global--spacer--sm)';

export const PagePadding: React.FC<PagePaddingProps> = ({
  children,
  top = PF_SPACER_SM,
  bottom = PF_SPACER_SM,
  left = PF_SPACER_SM,
  right = PF_SPACER_SM,
}) => {
  const style = {
    paddingTop: top,
    paddingBottom: bottom,
    paddingLeft: left,
    paddingRight: right,
  };

  return <div style={style}>{children}</div>;
};
