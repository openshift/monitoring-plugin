import { PanelProps } from '@perses-dev/dashboards';
import { ReactNode } from 'react';

export const Panel = ({ definition, panelOptions }: PanelProps) => (
  <div data-testid="mock-panel">
    <div data-testid="panel-definition" data-definition={JSON.stringify(definition)} />
    {panelOptions?.extra && <div data-testid="panel-extra">{panelOptions.extra({})}</div>}
  </div>
);

export const VariableProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
