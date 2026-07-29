import { t_global_spacer_sm } from '@patternfly/react-tokens';
import { FC, ReactNode } from 'react';

interface PagePaddingProps {
  children: ReactNode;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

export const PagePadding: FC<PagePaddingProps> = ({
  children,
  top = t_global_spacer_sm.value,
  bottom = t_global_spacer_sm.value,
  left = t_global_spacer_sm.value,
  right = t_global_spacer_sm.value,
}) => {
  const style = {
    paddingTop: top,
    paddingBottom: bottom,
    paddingLeft: left,
    paddingRight: right,
  };

  return <div style={style}>{children}</div>;
};
