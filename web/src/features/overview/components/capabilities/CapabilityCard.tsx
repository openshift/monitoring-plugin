import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  Icon,
  Label,
  List,
  ListItem,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import {
  RhUiCheckCircleFillIcon,
  RhUiErrorFillIcon,
  RhUiMinusCircleFillIcon,
  RhUiWarningFillIcon,
} from '@patternfly/react-icons';
import { isEmpty } from 'lodash-es';
import { type FC, Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { COO_ID } from '@/features/overview/constants/const';
import {
  CapabilityStatus,
  ObservabilityCapability,
  RequiredConfig,
  RequiredConfigType,
  RequiredOperator,
  RequirementStatus,
} from '@/features/overview/types/types';
import {
  editResourceKindPath,
  getCreateResourceURL,
  getNewPluginURL,
  groupVersionKindToPath,
} from '@/features/overview/utils/services-utils';
import { ExternalLink } from '@/shared/console/utils/Link';
import { DataTestIDs } from '@/shared/constants/data-test';

const renderRequirementIcon = (
  status: RequirementStatus,
  isConfig: boolean,
  requiredMissing: boolean,
) => {
  if (requiredMissing) {
    return (
      <RhUiMinusCircleFillIcon style={{ color: 'var(--pf-t--global--icon--color--disabled)' }} />
    );
  }
  switch (status) {
    case RequirementStatus.Success:
      return (
        <Icon status="success">
          <RhUiCheckCircleFillIcon />
        </Icon>
      );
    case RequirementStatus.Degraded:
      return (
        <Icon status="danger">
          <RhUiErrorFillIcon />
        </Icon>
      );
    case RequirementStatus.Missing:
      return isConfig ? (
        <Icon status="warning">
          <RhUiWarningFillIcon />
        </Icon>
      ) : (
        <RhUiMinusCircleFillIcon style={{ color: 'var(--pf-t--global--icon--color--disabled)' }} />
      );
  }
};

export type CapabilityCardProps = {
  capability: ObservabilityCapability;
  monitoringPlugin: K8sResourceKind;
};

export const CapabilityCard: FC<CapabilityCardProps> = ({ capability, monitoringPlugin }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const coo = capability.requiredOperators.find((capability) => capability.id === COO_ID)?.csv;

  const statusLabel = useMemo(() => {
    switch (capability.status) {
      case CapabilityStatus.Ready:
        return (
          <Label color="green" isCompact icon={<RhUiCheckCircleFillIcon />}>
            {t('Ready')}
          </Label>
        );
      case CapabilityStatus.Partial:
        return <Label isCompact>{t('Partial setup')}</Label>;
      case CapabilityStatus.Available:
        return <Label isCompact>{t('Available')}</Label>;
      default:
        return null;
    }
  }, [capability, t]);

  const renderRequiredItem = (
    status: RequirementStatus,
    title: string,
    isConfig: boolean,
    requiredMissing: boolean,
  ) => (
    <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'nowrap' }}>
      <FlexItem>{renderRequirementIcon(status, isConfig, requiredMissing)}</FlexItem>
      <FlexItem>
        <Content>{title}</Content>
      </FlexItem>
    </Flex>
  );

  const renderOperatorLink = (operator: RequiredOperator) => {
    if (operator.missingPrerequisite) {
      return null;
    }

    if (operator.status === RequirementStatus.Missing) {
      return (
        <Link className="pf-v6-u-ml-lg" to={`/catalog/all-namespaces?keyword=${operator.keywords}`}>
          {t('Install')}
        </Link>
      );
    }

    if (operator.csv?.metadata) {
      const path =
        `/k8s/ns/${operator.csv.metadata.namespace}/` +
        `${groupVersionKindToPath(operator.groupVersionKind)}/` +
        `${operator.csv.metadata.name}`;

      return (
        <Link className="pf-v6-u-ml-lg" to={path}>
          {t('Details')}
        </Link>
      );
    }

    return null;
  };

  const renderConfigLink = (config: RequiredConfig) => {
    if (config.type === RequiredConfigType.CustomResource) {
      if (!config.isRequiredOperatorInstalled) {
        return null;
      }

      const path = getCreateResourceURL(config, capability.requiredOperators);
      if (!path) {
        return null;
      }

      return (
        <Link className="pf-v6-u-ml-lg" to={path}>
          {t('Configure')}
        </Link>
      );
    }

    if (config.type === RequiredConfigType.MonitoringFeature) {
      if (!monitoringPlugin) {
        return null;
      }
      const path = editResourceKindPath(monitoringPlugin);
      if (path === '#') {
        return null;
      }
      return (
        <Link className="pf-v6-u-ml-lg" to={path}>
          {t('Enable')}
        </Link>
      );
    }

    if (coo) {
      const path = getNewPluginURL(coo);
      return (
        <Link className="pf-v6-u-ml-lg" to={path}>
          {t('Enable')}
        </Link>
      );
    }

    return null;
  };

  return (
    <Card isFullHeight data-test={`${DataTestIDs.OverviewPage.CapabilityCard}-${capability.id}`}>
      <CardHeader>
        <CardTitle
          subtitle={
            !isEmpty(capability.requiredLabels) &&
            capability.requiredLabels.map((dependencyLabel, index) => (
              <Fragment key={dependencyLabel}>
                {index > 0 ? <span> · </span> : null}
                {dependencyLabel}
              </Fragment>
            ))
          }
        >
          <Flex
            spaceItems={{ default: 'spaceItemsSm' }}
            justifyContent={{ default: 'justifyContentSpaceBetween' }}
            flexWrap={{ default: 'nowrap' }}
          >
            <FlexItem>{capability.title}</FlexItem>
            <FlexItem>{statusLabel}</FlexItem>
          </Flex>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <Content component="p">{capability.description}</Content>
          </StackItem>
          {!isEmpty(capability.requiredOperators) ? (
            <StackItem>
              <Content component="h4">{t('Required operators')}</Content>
              <List isPlain>
                {capability.requiredOperators.map((operator) => (
                  <ListItem key={operator.title}>
                    <Flex
                      direction={{ default: 'column' }}
                      spaceItems={{ default: 'spaceItemsXs' }}
                    >
                      <FlexItem>
                        {renderRequiredItem(operator.status, operator.title, false, false)}
                      </FlexItem>
                      {operator.status !== RequirementStatus.Success ? (
                        <FlexItem>{renderOperatorLink(operator)}</FlexItem>
                      ) : null}
                    </Flex>
                  </ListItem>
                ))}
              </List>
            </StackItem>
          ) : null}
          {!isEmpty(capability.requiredConfigs) ? (
            <StackItem>
              <Content component="h4">{t('Configurations')}</Content>
              <List isPlain>
                {capability.requiredConfigs.map((config) => (
                  <ListItem key={config.title}>
                    <Flex
                      direction={{ default: 'column' }}
                      spaceItems={{ default: 'spaceItemsXs' }}
                    >
                      <FlexItem>
                        {renderRequiredItem(
                          config.status,
                          config.title,
                          true,
                          !config.isRequiredOperatorInstalled,
                        )}
                      </FlexItem>
                      {config.status !== RequirementStatus.Success ? (
                        <FlexItem>{renderConfigLink(config)}</FlexItem>
                      ) : null}
                    </Flex>
                  </ListItem>
                ))}
              </List>
            </StackItem>
          ) : null}
        </Stack>
      </CardBody>
      <CardFooter>
        <ExternalLink href={capability.learnMoreUrl} text={t('Learn more')} />
      </CardFooter>
    </Card>
  );
};
