import * as React from 'react';
import {
  Alert,
  Flex,
  FlexItem,
  PageSection,
  PageSectionVariants,
  Title,
} from '@patternfly/react-core';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  IncompleteDataError,
  TimeoutError,
} from '@openshift-console/dynamic-plugin-sdk/lib/utils/error/http-error';
import { EmptyBox } from '../empty-state/EmptyBox';
import { AccessDenied } from '../empty-state/AccessDenied';
import { LoadingBox } from '../loading/LoadingBox';
import { LoadError } from '../loading/LoadError';
import { getLastLanguage } from '../../../../utils/getLastLanguage';

const Data: React.FC<DataProps> = ({
  NoDataEmptyMsg,
  EmptyMsg,
  label,
  data,
  unfilteredData,
  children,
}) => {
  if (NoDataEmptyMsg && _.isEmpty(unfilteredData)) {
    return (
      <div className="loading-box loading-box__loaded">
        {NoDataEmptyMsg ? <NoDataEmptyMsg /> : <EmptyBox label={label} />}
      </div>
    );
  }

  if (!data || _.isEmpty(data)) {
    return (
      <div className="loading-box loading-box__loaded">
        {EmptyMsg ? <EmptyMsg /> : <EmptyBox label={label} />}
      </div>
    );
  }
  return <div className="loading-box loading-box__loaded">{children}</div>;
};
Data.displayName = 'Data';

export const StatusBox: React.FC<StatusBoxProps> = (props) => {
  const { loadError, loaded, skeleton, data, ...dataProps } = props;
  const { t } = useTranslation('console-shared');

  if (loadError) {
    const status = _.get(loadError, 'response.status');
    if (status === 404) {
      return (
        <PageSection variant={PageSectionVariants.light}>
          <Flex justifyContent={{ default: 'justifyContentCenter' }}>
            <FlexItem>
              <Title headingLevel="h1">{t('404: Not Found')}</Title>
            </FlexItem>
          </Flex>
        </PageSection>
      );
    }
    if (status === 403) {
      return <AccessDenied>{loadError.message}</AccessDenied>;
    }

    if (loadError instanceof IncompleteDataError && !_.isEmpty(data)) {
      return (
        <Data data={data} {...dataProps}>
          <Alert
            variant="info"
            isInline
            title={t(
              '{{labels}} content is not available in the catalog at this time due to loading failures.',
              {
                labels: new Intl.ListFormat(getLastLanguage() || 'en', {
                  style: 'long',
                  type: 'conjunction',
                }).format(loadError.labels),
              },
            )}
          />
          {props.children}
        </Data>
      );
    }

    if (loaded && loadError instanceof TimeoutError) {
      return (
        <Data data={data} {...dataProps}>
          <div className="co-m-timeout-error text-muted">
            {t('Timed out fetching new data. The data below is stale.')}
          </div>
          {props.children}
        </Data>
      );
    }

    return <LoadError label={props.label}>{loadError.message}</LoadError>;
  }

  if (!loaded) {
    return skeleton ? <>{skeleton}</> : <LoadingBox />;
  }
  return <Data data={data} {...dataProps} />;
};
StatusBox.displayName = 'StatusBox';

type DataProps = {
  NoDataEmptyMsg?: React.ComponentType;
  EmptyMsg?: React.ComponentType;
  label?: string;
  unfilteredData?: any;
  data?: any;
  children?: React.ReactNode;
};

type StatusBoxProps = {
  label?: string;
  loadError?: any;
  loaded?: boolean;
  data?: any;
  unfilteredData?: any;
  skeleton?: React.ReactNode;
  NoDataEmptyMsg?: React.ComponentType;
  EmptyMsg?: React.ComponentType;
  children?: React.ReactNode;
};
