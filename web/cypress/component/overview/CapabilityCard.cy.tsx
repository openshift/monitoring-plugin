import { MemoryRouter } from 'react-router';

import { CapabilityCard } from '@/features/overview/components/capabilities/CapabilityCard';
import {
  CapabilityStatus,
  ObservabilityCapability,
  RequiredConfigType,
  RequirementStatus,
} from '@/features/overview/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

import {
  buildCapability,
  buildConfig,
  buildOperator,
  cooCSV,
  monitoringPlugin,
  statusIcon,
} from './fixtures';

const mountCard = (
  capability: ObservabilityCapability,
  plugin: typeof monitoringPlugin | undefined,
) => {
  cy.mount(
    <MemoryRouter>
      <CapabilityCard capability={capability} monitoringPlugin={plugin} />
    </MemoryRouter>,
  );
};

const card = (id: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.CapabilityCard}-${id}"]`);

describe('CapabilityCard', () => {
  it('renders the title, description, and required labels', () => {
    mountCard(buildCapability(), monitoringPlugin);

    card('monitoring').should('be.visible');
    cy.contains('Monitoring').should('be.visible');
    cy.contains('Collect metrics and manage alerting across cluster workloads.').should(
      'be.visible',
    );
    card('monitoring')
      .find('.pf-v6-c-card__subtitle')
      .invoke('text')
      .should('eq', 'COO · MonitoringStack');
  });

  it('does not render a subtitle when there are no required labels', () => {
    mountCard(buildCapability({ requiredLabels: [] }), monitoringPlugin);

    card('monitoring').find('.pf-v6-c-card__subtitle').should('not.exist');
  });

  it('links to the learn more documentation', () => {
    mountCard(buildCapability(), monitoringPlugin);

    cy.contains('a', 'Learn more')
      .should('have.attr', 'href', 'https://docs.redhat.com/monitoring-ui-plugin')
      .and('have.attr', 'target', '_blank');
  });

  describe('status label', () => {
    it('shows Ready when the capability is fully configured', () => {
      mountCard(buildCapability({ status: CapabilityStatus.Ready }), monitoringPlugin);

      cy.get('.pf-v6-c-label').contains('Ready').should('be.visible');
    });

    it('shows Partial setup when some requirements are unmet', () => {
      mountCard(buildCapability({ status: CapabilityStatus.Partial }), monitoringPlugin);

      cy.get('.pf-v6-c-label').contains('Partial setup').should('be.visible');
    });

    it('shows Available when nothing is installed', () => {
      mountCard(buildCapability({ status: CapabilityStatus.Available }), monitoringPlugin);

      cy.get('.pf-v6-c-label').contains('Available').should('be.visible');
    });
  });

  describe('required operators', () => {
    it('omits the section when the capability declares no operators', () => {
      mountCard(buildCapability({ requiredOperators: [] }), monitoringPlugin);

      cy.contains('Required operators').should('not.exist');
    });

    it('hides the action link for an operator that is already running', () => {
      mountCard(buildCapability(), monitoringPlugin);

      cy.contains('Required operators').should('be.visible');
      cy.contains('Cluster Observability Operator').should('be.visible');
      cy.contains('a', 'Install').should('not.exist');
      cy.contains('a', 'Details').should('not.exist');
    });

    it('offers an Install link into the catalog when the operator is missing', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Available,
          requiredOperators: [buildOperator({ status: RequirementStatus.Missing, csv: undefined })],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Install').should(
        'have.attr',
        'href',
        '/catalog/all-namespaces?keyword=cluster observability operator',
      );
    });

    it('withholds the Install link when a prerequisite operator is missing', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Available,
          requiredOperators: [
            buildOperator({ status: RequirementStatus.Missing, csv: undefined }),
            buildOperator({
              id: 'loki-operator',
              title: 'Loki Operator',
              status: RequirementStatus.Missing,
              csv: undefined,
              keywords: 'loki operator',
              missingPrerequisite: true,
            }),
          ],
          requiredConfigs: [],
        }),
        monitoringPlugin,
      );

      card('monitoring')
        .find('a')
        .filter((_, el) => (el.textContent || '').trim() === 'Install')
        .should('have.length', 1);
      cy.contains('Cluster Observability Operator')
        .closest('li')
        .contains('a', 'Install')
        .should('exist');
      cy.contains('Loki Operator').closest('li').find('a').should('not.exist');
    });

    it('offers a Details link to the CSV when the operator is degraded', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredOperators: [buildOperator({ status: RequirementStatus.Degraded })],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Details').should(
        'have.attr',
        'href',
        '/k8s/ns/openshift-cluster-observability-operator/' +
          'operators.coreos.com~v1alpha1~ClusterServiceVersion/' +
          'cluster-observability-operator.v1.2.0',
      );
    });
  });

  describe('required configurations', () => {
    it('omits the section when the capability declares no configs', () => {
      mountCard(buildCapability({ requiredConfigs: [] }), monitoringPlugin);

      cy.contains('Required configurations').should('not.exist');
    });

    it('hides the action link for a config that is already present', () => {
      mountCard(buildCapability(), monitoringPlugin);

      cy.contains('Required configurations').should('be.visible');
      cy.contains('COO MonitoringStack CR').should('be.visible');
      cy.contains('a', 'Configure').should('not.exist');
    });

    it('offers a Configure link for a missing custom resource', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [buildConfig({ status: RequirementStatus.Missing })],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Configure').should(
        'have.attr',
        'href',
        '/k8s/ns/openshift-monitoring/monitoring.rhobs~v1alpha1~MonitoringStack/~new',
      );
    });

    it('withholds the Configure link and the warning icon when the owning operator is absent', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Available,
          requiredOperators: [buildOperator({ status: RequirementStatus.Missing, csv: undefined })],
          requiredConfigs: [
            buildConfig({ status: RequirementStatus.Missing, isRequiredOperatorInstalled: false }),
          ],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Configure').should('not.exist');
      card('monitoring').find(statusIcon('warning')).should('not.exist');
    });

    it('warns on a missing config whose owning operator is installed', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [buildConfig({ status: RequirementStatus.Missing })],
        }),
        monitoringPlugin,
      );

      card('monitoring').find(statusIcon('warning')).should('exist');
    });

    it('offers an Enable link for a missing UI plugin when COO is installed', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [
            buildConfig({
              id: 'logging',
              title: 'COO Logging UI Plugin CR',
              type: RequiredConfigType.UiPlugin,
              pluginName: 'Logging',
              status: RequirementStatus.Missing,
            }),
          ],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Enable').should(
        'have.attr',
        'href',
        `/k8s/ns/${cooCSV.metadata.namespace}/` +
          'operators.coreos.com~v1alpha1~ClusterServiceVersion/' +
          `${cooCSV.metadata.name}/` +
          'observability.openshift.io~v1alpha1~UIPlugin/~new',
      );
    });

    it('withholds the Enable link when COO is not among the required operators', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredOperators: [
            buildOperator({ id: 'loki-operator', title: 'Loki Operator', csv: undefined }),
          ],
          requiredConfigs: [
            buildConfig({
              id: 'logging',
              title: 'COO Logging UI Plugin CR',
              type: RequiredConfigType.UiPlugin,
              pluginName: 'Logging',
              status: RequirementStatus.Missing,
            }),
          ],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Enable').should('not.exist');
    });

    it('offers an Enable link for a missing monitoring feature when the monitoring UIPlugin is present', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [
            buildConfig({
              id: 'perses-dashboards',
              title: 'Perses Dashboards',
              type: RequiredConfigType.MonitoringFeature,
              featureName: 'perses',
              status: RequirementStatus.Missing,
            }),
          ],
        }),
        monitoringPlugin,
      );

      cy.contains('a', 'Enable').should(
        'have.attr',
        'href',
        '/k8s/ns/openshift-cluster-observability-operator/' +
          'observability.openshift.io~v1alpha1~UIPlugin/monitoring/yaml',
      );
    });

    it('withholds the Enable link for a missing monitoring feature when the monitoring UIPlugin is absent', () => {
      mountCard(
        buildCapability({
          status: CapabilityStatus.Partial,
          requiredConfigs: [
            buildConfig({
              id: 'perses-dashboards',
              title: 'Perses Dashboards',
              type: RequiredConfigType.MonitoringFeature,
              featureName: 'perses',
              status: RequirementStatus.Missing,
            }),
          ],
        }),
        undefined,
      );

      cy.contains('a', 'Enable').should('not.exist');
    });
  });
});
