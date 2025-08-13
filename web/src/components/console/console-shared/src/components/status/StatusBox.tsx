import type { FC, ComponentType, ReactNode } from 'react';
import { Alert, Flex, FlexItem, PageSection, Title } from '@patternfly/react-core';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { IncompleteDataError } from '@openshift-console/dynamic-plugin-sdk/lib/utils/error/http-error';
import { EmptyBox } from '../empty-state/EmptyBox';
import { AccessDenied } from '../empty-state/AccessDenied';
import { LoadingBox } from '../loading/LoadingBox';
import { LoadError } from '../loading/LoadError';
import { getLastLanguage } from '../../../../utils/getLastLanguage';

const Data: FC<DataProps> = ({
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

export const StatusBox: FC<StatusBoxProps> = (props) => {
  const { loadError, loaded, skeleton, data, ...dataProps } = props;
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  if (loadError) {
    const status = _.get(loadError, 'response.status');
    if (status === 404) {
      return (
        <PageSection hasBodyWrapper={false}>
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

    return <LoadError label={props.label}>{loadError.message}</LoadError>;
  }

  if (!loaded) {
    return skeleton ? <>{skeleton}</> : <LoadingBox />;
  }
  return <Data data={data} {...dataProps} />;
};
StatusBox.displayName = 'StatusBox';

type DataProps = {
  NoDataEmptyMsg?: ComponentType;
  EmptyMsg?: ComponentType;
  label?: string;
  unfilteredData?: any;
  data?: any;
  children?: ReactNode;
};

type StatusBoxProps = {
  label?: string;
  loadError?: any;
  loaded?: boolean;
  data?: any;
  unfilteredData?: any;
  skeleton?: ReactNode;
  NoDataEmptyMsg?: ComponentType;
  EmptyMsg?: ComponentType;
  children?: ReactNode;
};
