import { useState } from 'react';
import { useTempoResources } from '../../hooks/useTempoResources';
import { QueryBrowser } from './QueryBrowser';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  MenuToggle,
  PageSection,
  Title,
} from '@patternfly/react-core';
import { PlusCircleIcon, WrenchIcon, ExternalLinkAltIcon } from '@patternfly/react-icons';
import { useTranslation, Trans } from 'react-i18next';
import { ErrorAlert } from '../../components/ErrorAlert';
import { DocumentTitle } from '@openshift-console/dynamic-plugin-sdk';
import { Link } from 'react-router';
import { useTempoInstance } from '../../hooks/useTempoInstance';
import { LoadingState } from '../../components/LoadingState';
import { TracingApp } from '../../TracingApp';
import { getOCPVersion } from '../../components/console/utils/getOCPVersion';

function getInstallOperatorLink() {
  const v = getOCPVersion();

  // Starting with OCP 4.20, the URL to OperatorHub/Software Catalog changed.
  // If version is undefined, assume latest version.
  if (!v || v.major > 4 || (v.major === 4 && v.minor >= 20)) {
    return '/catalog/ns/default?keyword=Tempo&selectedId=tempo-product-redhat-operators-openshift-marketplace';
  }
  return '/operatorhub/all-namespaces?keyword=Tempo&details-item=tempo-product-redhat-operators-openshift-marketplace';
}

const createTempoStackLink =
  '/api-resource/all-namespaces/tempo.grafana.com~v1alpha1~TempoStack/instances';
const createTempoMonolithicLink =
  '/api-resource/all-namespaces/tempo.grafana.com~v1alpha1~TempoMonolithic/instances';
const viewInstallationDocsLink =
  'https://docs.redhat.com/en/documentation/openshift_container_platform/latest/html/distributed_tracing';

function TracesPage() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');

  return (
    <TracingApp>
      <DocumentTitle>{t('Tracing')}</DocumentTitle>
      <TracesPageBody />
    </TracingApp>
  );
}

export default TracesPage;

/**
 * TracesPageBody catches major error states like "Tempo Operator not installed" or "No Tempo instances created yet"
 * and shows an empty state instead of the query browser.
 */
function TracesPageBody() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { isLoading, error, data: tempoResources } = useTempoResources();
  const [tempo] = useTempoInstance();

  // show loading state (loading the list of Tempo CRs in the cluster)
  // only if no Tempo instance is selected (from the query params)
  if (!tempo && isLoading) {
    return <LoadingState />;
  }

  if (error) {
    if (error.json?.errorType === 'TempoCRDNotFound') {
      return <TempoOperatorNotInstalledState />;
    } else {
      return (
        <ErrorState
          errorType={error.json?.errorType}
          error={error.json?.error ?? t('Error connecting to the Tracing UI plugin backend')}
        />
      );
    }
  }

  if (!isLoading && tempoResources && tempoResources.length === 0) {
    return <NoTempoInstance />;
  }

  return <QueryBrowser />;
}

function TempoOperatorNotInstalledState() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const installOperatorLink = getInstallOperatorLink();

  return (
    <>
      <PageSection>
        <Title headingLevel="h1">{t('Traces')}</Title>
      </PageSection>
      <PageSection>
        <EmptyState
          titleText={t("Tempo operator isn't installed yet")}
          headingLevel="h4"
          icon={WrenchIcon}
        >
          <EmptyStateBody>
            {t(
              'To get started, install the Tempo operator and create a TempoStack or TempoMonolithic instance with multi-tenancy enabled.',
            )}
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button component={(props) => <Link {...props} to={installOperatorLink} />}>
                {t('Install Tempo operator')}
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      </PageSection>
    </>
  );
}

function NoTempoInstance() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <PageSection>
        <Title headingLevel="h1">{t('Traces')}</Title>
      </PageSection>
      <PageSection>
        <EmptyState titleText={t('No Tempo instances yet')} headingLevel="h4" icon={PlusCircleIcon}>
          <EmptyStateBody>
            <Trans t={t}>
              To get started, create a TempoStack or TempoMonolithic instance with multi-tenancy
              enabled.
              <br />
              Instances without multi-tenancy are not supported.
            </Trans>
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Dropdown
                isOpen={isOpen}
                onOpenChange={setOpen}
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    variant="primary"
                    onClick={() => setOpen(!isOpen)}
                    isExpanded={isOpen}
                  >
                    {t('Create a Tempo instance')}
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  <DropdownItem key="createTempoStackLink" to={createTempoStackLink}>
                    {t('Create a TempoStack instance')}
                  </DropdownItem>
                  <DropdownItem key="createTempoMonolithicLink" to={createTempoMonolithicLink}>
                    {t('Create a TempoMonolithic instance')}
                  </DropdownItem>
                </DropdownList>
              </Dropdown>
            </EmptyStateActions>
            <EmptyStateActions>
              <Button
                variant="link"
                component="a"
                href={viewInstallationDocsLink}
                target="_blank"
                rel="noopener noreferrer"
                icon={<ExternalLinkAltIcon />}
                iconPosition="right"
              >
                {t('View documentation')}
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      </PageSection>
    </>
  );
}

interface ErrorStateProps {
  errorType?: string;
  error?: string;
}

function ErrorState({ errorType, error }: ErrorStateProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  return (
    <>
      <PageSection>
        <Title headingLevel="h1">{t('Traces')}</Title>
      </PageSection>
      <PageSection>
        <ErrorAlert
          error={{ name: errorType ?? t('Error'), message: error ?? t('Unknown error') }}
        />
      </PageSection>
    </>
  );
}
