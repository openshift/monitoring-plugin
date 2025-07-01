import * as _ from 'lodash-es';
import * as React from 'react';
import { PrometheusEndpoint, PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye } from '@patternfly/react-core';

import ErrorAlert from './error';
import { getPrometheusURL } from '../../console/graphs/helpers';
import { usePoll } from '../../console/utils/poll-hook';
import { useSafeFetch } from '../../console/utils/safe-fetch-hook';

import { formatNumber } from '../../format';
import { usePerspective } from '../../hooks/usePerspective';
import { Panel } from './types';
import { useTranslation } from 'react-i18next';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';

const colorMap = {
  'super-light-blue': 'blue-100',
  'light-blue': 'blue-200',
  blue: 'blue-300',
  'semi-dark-blue': 'blue-400',
  'dark-blue': 'blue-500',

  'super-light-green': 'green-100',
  'light-green': 'green-200',
  green: 'green-300',
  'semi-dark-green': 'green-400',
  'dark-green': 'green-500',

  'super-light-orange': 'orange-100',
  'light-orange': 'orange-200',
  orange: 'orange-300',
  'semi-dark-orange': 'orange-400',
  'dark-orange': 'orange-500',

  'super-light-purple': 'purple-100',
  'light-purple': 'purple-200',
  purple: 'purple-300',
  'semi-dark-purple': 'purple-400',
  'dark-purple': 'purple-500',

  'super-light-red': 'red-100',
  'light-red': 'red-200',
  red: 'red-300',
  'semi-dark-red': 'red-400',
  'dark-red': 'red-500',

  'super-light-yellow': 'gold-100',
  'light-yellow': 'gold-200',
  yellow: 'gold-300',
  'semi-dark-yellow': 'gold-400',
  'dark-yellow': 'gold-500',
};

const getColorCSS = (colorName: string): string =>
  colorMap[colorName] ? `var(--pf-v5-chart-color-${colorMap[colorName]})` : undefined;

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Bullseye className="monitoring-dashboards__single-stat">{children}</Bullseye>
);

const SingleStat: React.FC<Props> = ({
  customDataSource,
  namespace,
  panel,
  pollInterval,
  query,
}) => {
  const {
    decimals,
    format,
    options,
    postfix,
    postfixFontSize,
    prefix,
    prefixFontSize,
    valueFontSize,
    valueMaps,
  } = panel;

  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [error, setError] = React.useState<string>();
  const [isLoading, setIsLoading] = React.useState(true);
  const [value, setValue] = React.useState<string>();
  const { perspective } = usePerspective();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);

  const url = getPrometheusURL(
    {
      endpoint: PrometheusEndpoint.QUERY,
      query,
      namespace: perspective === 'dev' ? namespace : '',
    },
    perspective,
    customDataSource?.basePath,
  );

  const tick = () => {
    if (!url) {
      return;
    }
    safeFetch(url)
      .then((response: PrometheusResponse) => {
        setError(undefined);
        setIsLoading(false);
        setValue(_.get(response, 'data.result[0].value[1]'));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(_.get(err, 'json.error', err.message));
          setIsLoading(false);
          setValue(undefined);
        }
      });
  };

  usePoll(tick, pollInterval, query);

  const filteredVMs = valueMaps?.filter((vm) => vm.op === '=');
  const valueMap =
    value === undefined
      ? filteredVMs?.find((vm) => vm.value === 'null')
      : filteredVMs?.find((vm) => vm.value === value);

  if (isLoading) {
    return <LoadingInline />;
  }
  if (error) {
    return <ErrorAlert error={{ message: error, name: t('An error occurred') }} />;
  }

  let color;
  const thresholds = options?.fieldOptions?.thresholds;
  if (thresholds && value !== undefined) {
    const thresholdIndex =
      _.sortedIndexBy(thresholds, { value: Number(value) }, (t) => Number(t.value)) - 1;
    color = getColorCSS(thresholds[thresholdIndex]?.color);
  }

  return (
    <Body>
      {prefix && <span style={{ color, fontSize: prefixFontSize }}>{prefix}</span>}
      <span style={{ color, fontSize: valueFontSize }}>
        {valueMap ? valueMap.text : formatNumber(value, decimals, format)}
      </span>
      {postfix && <span style={{ color, fontSize: postfixFontSize }}>{postfix}</span>}
    </Body>
  );
};

type Props = {
  customDataSource?: CustomDataSource;
  panel: Panel;
  pollInterval: number;
  query: string;
  namespace?: string;
};

export default SingleStat;
