import {
  Panel,
  PanelMain,
  PanelMainBody,
  Sidebar,
  SidebarContent,
  SidebarPanel,
} from '@patternfly/react-core';
import { ReactNode } from 'react';

type Props = {
  filters?: ReactNode;
  children: ReactNode;
  filtersId: string;
};

export function PageWithFilters({ filters, children, filtersId }: Props) {
  return (
    <Sidebar hasGutter hasNoBackground>
      {filters && (
        <SidebarPanel id={filtersId} variant="sticky" hasNoBackground>
          <Panel variant="bordered">
            <PanelMain>
              <PanelMainBody>{filters}</PanelMainBody>
            </PanelMain>
          </Panel>
        </SidebarPanel>
      )}
      <SidebarContent hasNoBackground style={{ minWidth: 0 }}>
        {children}
      </SidebarContent>
    </Sidebar>
  );
}
