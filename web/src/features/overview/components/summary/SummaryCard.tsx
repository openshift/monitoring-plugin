import { RedExclamationCircleIcon } from '@openshift-console/dynamic-plugin-sdk';
import { Card, CardBody, Content, Flex, FlexItem, Icon, Tooltip } from '@patternfly/react-core';
import {
  RhUiCheckCircleFillIcon,
  RhUiErrorFillIcon,
  RhUiInformationFillIcon,
  RhUiWarningFillIcon,
} from '@patternfly/react-icons';
import { type ComponentProps, type FC, type ReactNode } from 'react';

import { Loading } from '@/shared/console/console-shared/src/components/loading/Loading';
import { DataTestIDs } from '@/shared/constants/data-test';

export type SummaryCardProps = {
  count: string | number;
  title: string;
  status?: ComponentProps<typeof Icon>['status'];
  footer?: ReactNode;
  cardId: string;
  loading?: boolean;
  error?: string;
};

const getIconForStatus = (status: ComponentProps<typeof Icon>['status']) => {
  switch (status) {
    case 'success':
      return <RhUiCheckCircleFillIcon />;
    case 'danger':
      return <RhUiErrorFillIcon />;
    case 'warning':
      return <RhUiWarningFillIcon />;
    case 'info':
      return <RhUiInformationFillIcon />;
    default:
      return null;
  }
};

const SummaryCard: FC<SummaryCardProps> = ({
  count,
  title,
  status,
  footer,
  cardId,
  loading,
  error,
}) => {
  const renderCountWithStatusIcon = () => {
    const icon = getIconForStatus(status);

    return (
      <Content component="h1" className="pf-v6-u-mt-sm">
        {icon ? (
          <Flex
            spaceItems={{ default: 'spaceItemsXs' }}
            flexWrap={{ default: 'nowrap' }}
            alignItems={{ default: 'alignItemsCenter' }}
          >
            <FlexItem>
              <Icon status={status} size="md">
                {icon}
              </Icon>
            </FlexItem>
            <FlexItem>{count}</FlexItem>
          </Flex>
        ) : (
          count
        )}
      </Content>
    );
  };

  return (
    <Card
      isCompact
      isFullHeight
      style={{ minWidth: '155px' }}
      data-test={`${DataTestIDs.OverviewPage.SummaryCard}-${cardId}`}
    >
      <CardBody>
        <Content component="h3">{title}</Content>
        {loading ? (
          <div data-test={`${DataTestIDs.OverviewPage.SummaryCardLoading}-${cardId}`}>
            <Loading className="pf-v6-u-font-size-2xl" />
          </div>
        ) : error ? (
          <Tooltip content={error}>
            <Icon status="danger" size="xl">
              <RedExclamationCircleIcon />
            </Icon>
          </Tooltip>
        ) : (
          renderCountWithStatusIcon()
        )}
        {footer ? <Content component="small">{footer}</Content> : null}
      </CardBody>
    </Card>
  );
};

export default SummaryCard;
