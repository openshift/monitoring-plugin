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

const spans = ['1d', '3d', '7d', '15d'];

const IncidentsPage = ({
  customDataSource,
  defaultTimespan = parsePrometheusDuration('7d'),
  namespace,
  timespan,
}) => {
  const [startingDate, setStartingDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [incidentsPageData, setIncidentsPageData] = React.useState([]);
  //data that is mapped and changed from timestamps to a format HH/DD/MM/YY
  const [processedData, setProcessedData] = React.useState([]);
  const defaultSpanText = spans.find((s) => parsePrometheusDuration(s) >= defaultTimespan);
  const [span, setSpan] = React.useState(parsePrometheusDuration(defaultSpanText));
  //used to define the Xdomain of chart
  const [xDomain, setXDomain] = React.useState();

  const now = Date.now();
  const endTime = xDomain?.[1];
  const timeRanges = getTimeRanges(span, endTime || now);
  //TEMPORARY to manipulate the API request - use values '1d', '3d', '7d', '15d'
  //and change the defaultTimespan -> it will fetch 1 to 15d and populate the array with data
  const safeFetch = useSafeFetch();
  React.useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await safeFetch(
            getPrometheusURL(
              {
                endpoint: PrometheusEndpoint.QUERY_RANGE,
                endTime: range.endTime,
                namespace,
                query: 'ALERTS',
                samples: 100,
                timespan: range.duration - 1,
              },
              customDataSource?.basePath,
            ),
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
          setProcessedData(processIncidentsTimestamps(aggregatedData));
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, []);

  return (
    <>
      <div className="co-m-pane__body">
        <IncidentsHeader alertsData={processedData} chartDays={timeRanges.length} />
      </div>
    </>
  );
};

export default IncidentsPage;
