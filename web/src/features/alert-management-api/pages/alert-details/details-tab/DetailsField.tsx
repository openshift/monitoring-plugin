import {
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from '@patternfly/react-core';
import type { ReactNode } from 'react';

type DetailsFieldProps = {
  name: string;
  description: ReactNode;
};

export function DetailsField({ name, description }: DetailsFieldProps) {
  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{name}</DescriptionListTerm>
      <DescriptionListDescription>{description}</DescriptionListDescription>
    </DescriptionListGroup>
  );
}
