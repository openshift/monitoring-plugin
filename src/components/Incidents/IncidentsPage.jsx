import * as React from 'react';
import { Helmet } from 'react-helmet';
import { IncidentsHeader } from './IncidentsHeader/IncidentsHeader';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { PrometheusEndpoint } from '@openshift-console/dynamic-plugin-sdk';
import { getTimeRanges } from '../utils';
import { parsePrometheusDuration } from '../console/utils/datetime';
import { getPrometheusURL } from '../console/graphs/helpers';
import { useDispatch } from 'react-redux';
import * as _ from 'lodash-es';
import { processIncidentsTimestamps } from './utils';

const minSamples = 10;
const maxSamples = 300;
const minStep = 5 * 1000;
const getMaxSamplesForSpan = (span) => _.clamp(Math.round(span / minStep), minSamples, maxSamples);
const spans = ['1d', '3d', '7d', '15d'];

const IncidentsPage = ({
  customDataSource,
  defaultTimespan = parsePrometheusDuration('7d'),
  defaultSamples,
  namespace,
  timespan,
  fixedXDomain,
}) => {
  const [startingDate, setStartingDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [incidentsPageData, setIncidentsPageData] = React.useState([]);
  const defaultSpanText = spans.find((s) => parsePrometheusDuration(s) >= defaultTimespan);
  const [span, setSpan] = React.useState(timespan || parsePrometheusDuration(defaultSpanText));
  //raw data
  const [data, setData] = React.useState([]);
  //data that is mapped and changed from timestamps to a format HH/DD/MM/YY
  const [processedData, setProcessedData] = React.useState([]);
  //will be used to define the Xdomain of chart
  const [xDomain, setXDomain] = React.useState();
  const maxSamplesForSpan = defaultSamples || getMaxSamplesForSpan(span);

  const [samples, setSamples] = React.useState(maxSamplesForSpan);
  const getXDomain = (endTime, span) => [endTime - span, endTime];
  React.useEffect(() => {
    setXDomain(getXDomain(Date.now(), span));
  }, [span, fixedXDomain]);
  const endTime = xDomain?.[1];

  React.useEffect(() => {
    if (timespan) {
      setSpan(timespan);
      setSamples(defaultSamples || getMaxSamplesForSpan(timespan));
    }
  }, [defaultSamples, timespan]);
  const safeFetch = useSafeFetch();
  const now = Date.now();
  const timeRanges = getTimeRanges(span, endTime || now);

  React.useEffect(() => {
    (async () => {
      try {
        const response = await safeFetch(
          getPrometheusURL(
            {
              endpoint: PrometheusEndpoint.QUERY_RANGE,
              endTime: 1722950372519,
              namespace,
              query: 'ALERTS',
              samples: Math.ceil(samples / timeRanges.length),
              timespan: 86400000 - 1,
            },
            customDataSource?.basePath,
          ),
        );
        setData(response.data.result);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err);
      }
    })();
  }, []);

  React.useEffect(() => {
    setProcessedData(processIncidentsTimestamps(data));
  }, [data]);

  return (
    <>
      <div className="co-m-pane__body">
        <IncidentsHeader />
      </div>
    </>
  );
};

export default IncidentsPage;
