import { Button, Icon, Popover } from '@patternfly/react-core';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { FC, ReactNode } from 'react';

interface HelpPopoverProps {
  header?: string;
  children?: ReactNode;
}

export const HelpPopover: FC<HelpPopoverProps> = ({ header, children }) => {
  return (
    <Popover headerContent={header} bodyContent={children}>
      <Button variant="plain" isInline>
        <Icon isInline size="sm">
          <OutlinedQuestionCircleIcon />
        </Icon>
      </Button>
    </Popover>
  );
};
