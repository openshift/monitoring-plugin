import type { PanelProps } from '@perses-dev/dashboards';

export const Panel = ({ definition, panelOptions }: PanelProps) => (
  <div data-test="mock-panel">
    <div data-test="panel-definition" data-definition={JSON.stringify(definition)} />
    {panelOptions?.extra && <div data-test="panel-extra">{panelOptions.extra({})}</div>}
  </div>
);
