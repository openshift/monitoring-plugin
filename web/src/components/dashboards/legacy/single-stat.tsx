import * as _ from 'lodash-es';
import * as React from 'react';
import { PrometheusEndpoint, PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Title } from '@patternfly/react-core';

import ErrorAlert from '../shared/error';
import { getPrometheusURL } from '../../console/graphs/helpers';
import { usePoll } from '../../console/utils/poll-hook';
import { useSafeFetch } from '../../console/utils/safe-fetch-hook';

import { formatNumber } from '../../format';
import { usePerspective } from '../../hooks/usePerspective';
import { Panel } from './types';
import { useTranslation } from 'react-i18next';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import {
  t_chart_color_blue_100,
  t_chart_color_blue_200,
  t_chart_color_blue_300,
  t_chart_color_blue_400,
  t_chart_color_blue_500,
  t_chart_color_green_100,
  t_chart_color_green_200,
  t_chart_color_green_300,
  t_chart_color_green_400,
  t_chart_color_green_500,
  t_chart_color_orange_100,
  t_chart_color_orange_200,
  t_chart_color_orange_300,
  t_chart_color_orange_400,
  t_chart_color_orange_500,
  t_chart_color_purple_100,
  t_chart_color_purple_200,
  t_chart_color_purple_300,
  t_chart_color_purple_400,
  t_chart_color_purple_500,
  t_chart_color_red_orange_100,
  t_chart_color_red_orange_200,
  t_chart_color_red_orange_300,
  t_chart_color_red_orange_400,
  t_chart_color_red_orange_500,
  t_chart_color_yellow_100,
  t_chart_color_yellow_200,
  t_chart_color_yellow_300,
  t_chart_color_yellow_400,
  t_chart_color_yellow_500,
} from '@patternfly/react-tokens';
import { PatternflyToken } from '../../types';

const colorMap: Record<string, PatternflyToken> = {
  'super-light-blue': t_chart_color_blue_100,
  'light-blue': t_chart_color_blue_200,
  blue: t_chart_color_blue_300,
  'semi-dark-blue': t_chart_color_blue_400,
  'dark-blue': t_chart_color_blue_500,

  'super-light-green': t_chart_color_green_100,
  'light-green': t_chart_color_green_200,
  green: t_chart_color_green_300,
  'semi-dark-green': t_chart_color_green_400,
  'dark-green': t_chart_color_green_500,

  'super-light-orange': t_chart_color_orange_100,
  'light-orange': t_chart_color_orange_200,
  orange: t_chart_color_orange_300,
  'semi-dark-orange': t_chart_color_orange_400,
  'dark-orange': t_chart_color_orange_500,

  'super-light-purple': t_chart_color_purple_100,
  'light-purple': t_chart_color_purple_200,
  purple: t_chart_color_purple_300,
  'semi-dark-purple': t_chart_color_purple_400,
  'dark-purple': t_chart_color_purple_500,

  'super-light-red': t_chart_color_red_orange_100,
  'light-red': t_chart_color_red_orange_200,
  red: t_chart_color_red_orange_300,
  'semi-dark-red': t_chart_color_red_orange_400,
  'dark-red': t_chart_color_red_orange_500,

  'super-light-yellow': t_chart_color_yellow_100,
  'light-yellow': t_chart_color_yellow_200,
  yellow: t_chart_color_yellow_300,
  'semi-dark-yellow': t_chart_color_yellow_400,
  'dark-yellow': t_chart_color_yellow_500,
};

const getColorCSS = (colorName: string): string =>
  colorMap[colorName] ? colorMap[colorName].var : undefined;

const Body: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <Bullseye style={{ color }}>{children}</Bullseye>
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

  let color: string;
  const thresholds = options?.fieldOptions?.thresholds;
  if (thresholds && value !== undefined) {
    const thresholdIndex =
      _.sortedIndexBy(thresholds, { value: Number(value) }, (t) => Number(t.value)) - 1;
    color = getColorCSS(thresholds[thresholdIndex]?.color);
  }

  return (
    <Body color={color}>
      <Title headingLevel="h3" size="3xl">
        {prefix && <span style={{ fontSize: prefixFontSize, color }}>{prefix}</span>}
        <span style={{ fontSize: valueFontSize, color }}>
          {valueMap ? valueMap.text : formatNumber(value, decimals, format)}
        </span>
        {postfix && <span style={{ fontSize: postfixFontSize }}>{postfix}</span>}
      </Title>
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
