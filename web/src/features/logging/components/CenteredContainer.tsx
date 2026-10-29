import { Flex, FlexItem } from '@patternfly/react-core';
import { FC, PropsWithChildren } from 'react';

export const CenteredContainer: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Flex
      justifyContent={{ default: 'justifyContentCenter' }}
      alignContent={{ default: 'alignContentCenter' }}
      style={{ height: '100%' }}
    >
      <FlexItem>{children}</FlexItem>
    </Flex>
  );
};
