import { MemoryRouter } from 'react-router';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { CapabilityCard } from '@/features/overview/components/capabilities/CapabilityCard';
import {
  buildCapability,
  buildConfig,
  buildOperator,
  cooCSV,
  monitoringPlugin,
  statusIcon,
} from '@/features/overview/test-utils/fixtures';
import { capabilityCard } from '@/features/overview/test-utils/selectors';
import {
  CapabilityStatus,
  ObservabilityCapability,
  RequiredConfigType,
  RequirementStatus,
} from '@/features/overview/types/types';

const mountCard = (
  capability: ObservabilityCapability,
  plugin: typeof monitoringPlugin | undefined,
) =>
  render(
    <MemoryRouter>
      <CapabilityCard capability={capability} monitoringPlugin={plugin} />
    </MemoryRouter>,
  );

const link = (name: string) => page.getByRole('link', { name, exact: true });
const icon = (status: Parameters<typeof statusIcon>[0]) =>
  capabilityCard('monitoring').element().querySelector<HTMLElement>(statusIcon(status));

describe('CapabilityCard', () => {
  it('renders the title, description, and required labels', async () => {
    await mountCard(buildCapability(), monitoringPlugin);
    await expect.element(capabilityCard('monitoring')).toBeVisible();
    await expect.element(page.getByText('Monitoring', { exact: true })).toBeVisible();
    await expect
      .element(page.getByText('Collect metrics and manage alerting across cluster workloads.'))
      .toBeVisible();
    await expect
      .element(document.querySelector<HTMLElement>('.pf-v6-c-card__subtitle'))
      .toHaveTextContent('COO · MonitoringStack');
  });

  it('does not render a subtitle when there are no required labels', async () => {
    await mountCard(buildCapability({ requiredLabels: [] }), monitoringPlugin);
    await expect
      .element(document.querySelector<HTMLElement>('.pf-v6-c-card__subtitle'))
      .not.toBeInTheDocument();
  });

  it('links to the learn more documentation', async () => {
    await mountCard(buildCapability(), monitoringPlugin);
    await expect
      .element(link('Learn more'))
      .toHaveAttribute('href', 'https://docs.redhat.com/monitoring-ui-plugin');
    await expect.element(link('Learn more')).toHaveAttribute('target', '_blank');
  });

  describe('status label', () => {
    it.each([
      { status: CapabilityStatus.Ready, label: 'Ready' },
      { status: CapabilityStatus.Partial, label: 'Partial setup' },
      { status: CapabilityStatus.Available, label: 'Available' },
    ])('shows $label for $status capabilities', async ({ status, label }) => {
      await mountCard(buildCapability({ status }), monitoringPlugin);
      await expect.element(page.getByText(label, { exact: true })).toBeVisible();
    });
  });

  describe('required operators', () => {
    it('omits the section when the capability declares no operators', async () => {
      await mountCard(buildCapability({ requiredOperators: [] }), monitoringPlugin);
      await expect
        .element(page.getByText('Required operators', { exact: true }))
        .not.toBeInTheDocument();
    });

    it('hides the action link for an operator that is already running', async () => {
      await mountCard(buildCapability(), monitoringPlugin);
      await expect.element(page.getByText('Required operators', { exact: true })).toBeVisible();
      await expect
        .element(page.getByText('Cluster Observability Operator', { exact: true }))
        .toBeVisible();
      await expect.element(link('Install')).not.toBeInTheDocument();
      await expect.element(link('Details')).not.toBeInTheDocument();
    });

    it('offers an Install link into the catalog when the operator is missing', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Available,
          requiredOperators: [buildOperator({ status: RequirementStatus.Missing, csv: undefined })],
        }),
        monitoringPlugin,
      );
      await expect
        .element(link('Install'))
        .toHaveAttribute(
          'href',
          '/catalog/all-namespaces?category=observability&keyword=cluster observability operator',
        );
    });

    it('offers a Details link to the CSV when the operator is degraded', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredOperators: [buildOperator({ status: RequirementStatus.Degraded })],
        }),
        monitoringPlugin,
      );
      await expect
        .element(link('Details'))
        .toHaveAttribute(
          'href',
          '/k8s/ns/openshift-cluster-observability-operator/' +
            'operators.coreos.com~v1alpha1~ClusterServiceVersion/cluster-observability-operator.v1.2.0',
        );
    });

    it('offers an Installing link to the Subscription when the operator is not yet installed', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredOperators: [
            buildOperator(),
            buildOperator({
              id: 'loki-operator',
              title: 'Loki Operator',
              keywords: 'loki operator',
              status: RequirementStatus.Degraded,
              csv: undefined,
              subscription: {
                metadata: { name: 'loki-operator', namespace: 'openshift-operators' },
                spec: { startingCSV: 'loki-operator.v3.2.1' },
              },
            }),
          ],
        }),
        monitoringPlugin,
      );
      const row = page.elementLocator(
        page.getByText('Loki Operator', { exact: true }).element().closest('li'),
      );
      await expect
        .element(row.getByRole('link', { name: 'Installing', exact: true }))
        .toHaveAttribute(
          'href',
          '/k8s/ns/openshift-operators/operators.coreos.com~v1alpha1~Subscription/loki-operator',
        );
    });
  });

  describe('required configurations', () => {
    it('omits the section when the capability declares no configs', async () => {
      await mountCard(buildCapability({ requiredConfigs: [] }), monitoringPlugin);
      await expect
        .element(page.getByText('Configurations', { exact: true }))
        .not.toBeInTheDocument();
    });

    it('hides the action link for a config that is already present', async () => {
      await mountCard(buildCapability(), monitoringPlugin);
      await expect.element(page.getByText('Configurations', { exact: true })).toBeVisible();
      await expect.element(page.getByText('COO MonitoringStack CR', { exact: true })).toBeVisible();
      await expect.element(link('Configure')).not.toBeInTheDocument();
    });

    it('offers a Configure link for a missing custom resource', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [buildConfig({ status: RequirementStatus.Missing })],
        }),
        monitoringPlugin,
      );
      await expect
        .element(link('Configure'))
        .toHaveAttribute(
          'href',
          '/k8s/ns/openshift-monitoring/monitoring.rhobs~v1alpha1~MonitoringStack/~new',
        );
    });

    it('withholds the Configure link and the warning icon when the owning operator is absent', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Available,
          requiredOperators: [buildOperator({ status: RequirementStatus.Missing, csv: undefined })],
          requiredConfigs: [
            buildConfig({ status: RequirementStatus.Missing, isRequiredOperatorInstalled: false }),
          ],
        }),
        monitoringPlugin,
      );
      await expect.element(link('Configure')).not.toBeInTheDocument();
      await expect.element(icon('warning')).not.toBeInTheDocument();
    });

    it('warns on a missing config whose owning operator is installed', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [buildConfig({ status: RequirementStatus.Missing })],
        }),
        monitoringPlugin,
      );
      await expect.element(icon('warning')).toBeInTheDocument();
    });

    const missingUiPlugin = buildConfig({
      id: 'logging',
      title: 'COO Logging UI Plugin CR',
      type: RequiredConfigType.UiPlugin,
      pluginName: 'Logging',
      status: RequirementStatus.Missing,
    });

    it('offers an Enable link for a missing UI plugin when COO is installed', async () => {
      await mountCard(
        buildCapability({ status: CapabilityStatus.Partial, requiredConfigs: [missingUiPlugin] }),
        monitoringPlugin,
      );
      await expect
        .element(link('Enable'))
        .toHaveAttribute(
          'href',
          `/k8s/ns/${cooCSV.metadata.namespace}/` +
            'operators.coreos.com~v1alpha1~ClusterServiceVersion/' +
            `${cooCSV.metadata.name}/observability.openshift.io~v1alpha1~UIPlugin/~new`,
        );
    });

    it('withholds the Enable link when COO is not among the required operators', async () => {
      await mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredOperators: [
            buildOperator({ id: 'loki-operator', title: 'Loki Operator', csv: undefined }),
          ],
          requiredConfigs: [missingUiPlugin],
        }),
        monitoringPlugin,
      );
      await expect.element(link('Enable')).not.toBeInTheDocument();
    });

    const missingFeature = buildConfig({
      id: 'perses-dashboards',
      title: 'Perses Dashboards',
      type: RequiredConfigType.MonitoringFeature,
      featureName: 'perses',
      status: RequirementStatus.Missing,
    });

    it('offers an Enable link for a missing monitoring feature when the monitoring UIPlugin is present', async () => {
      await mountCard(
        buildCapability({ status: CapabilityStatus.Partial, requiredConfigs: [missingFeature] }),
        monitoringPlugin,
      );
      await expect
        .element(link('Enable'))
        .toHaveAttribute(
          'href',
          '/k8s/ns/openshift-cluster-observability-operator/' +
            'observability.openshift.io~v1alpha1~UIPlugin/monitoring/yaml',
        );
    });

    it('withholds the Enable link for a missing monitoring feature when the monitoring UIPlugin is absent', async () => {
      await mountCard(
        buildCapability({ status: CapabilityStatus.Partial, requiredConfigs: [missingFeature] }),
        undefined,
      );
      await expect.element(link('Enable')).not.toBeInTheDocument();
    });
  });
});
