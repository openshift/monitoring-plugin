import { RedExclamationCircleIcon } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Card, CardBody, Content, Icon, Tooltip } from '@patternfly/react-core';
import { type FC } from 'react';
import { useNavigate } from 'react-router';

import { Loading } from '@/shared/console/console-shared/src/components/loading/Loading';
import { DataTestIDs } from '@/shared/constants/data-test';

export type SummaryCardProps = {
  count: number;
  title: string;
  url: string;
  cardId: string;
  loading?: boolean;
  error?: string;
};

const SummaryCard: FC<SummaryCardProps> = ({ count, title, url, cardId, loading, error }) => {
  const navigate = useNavigate();

  return (
    <Card
      isCompact
      isFullHeight
      style={{ minWidth: '155px' }}
      data-test={`${DataTestIDs.McpOverviewPage.SummaryCard}-${cardId}`}
    >
      <CardBody>
        <Content component="h3">{title}</Content>
        {loading ? (
          <div data-test={`${DataTestIDs.McpOverviewPage.SummaryCardLoading}-${cardId}`}>
            <Loading className="pf-v6-u-font-size-2xl" />
          </div>
        ) : error ? (
          <Tooltip content={error}>
            <Button
              isInline
              variant="link"
              className="pf-v6-u-font-size-2xl"
              style={{ width: 'fit-content' }}
              data-test={`${DataTestIDs.McpOverviewPage.SummaryCardError}-${cardId}`}
            >
              <Icon status="danger" size="xl">
                <RedExclamationCircleIcon />
              </Icon>
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="link"
            isInline
            className="pf-v6-u-font-size-2xl"
            onClick={() => navigate(url)}
            data-test={`${DataTestIDs.McpOverviewPage.SummaryCardCount}-${cardId}`}
          >
            {count}
          </Button>
        )}
      </CardBody>
    </Card>
  );
};

export default SummaryCard;
