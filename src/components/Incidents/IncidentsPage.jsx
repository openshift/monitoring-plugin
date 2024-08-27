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

const twoWeeksDateRanges = [
  { endTime: 1723625094404, duration: 86400000 },
  { endTime: 1723711494404, duration: 86400000 },
  { endTime: 1723797894404, duration: 86400000 },
  { endTime: 1723884294404, duration: 86400000 },
  { endTime: 1723970694404, duration: 86400000 },
  { endTime: 1724057094404, duration: 86400000 },
  { endTime: 1724143494404, duration: 86400000 },
  { endTime: 1724229894404, duration: 86400000 },
  { endTime: 1724316294404, duration: 86400000 },
  { endTime: 1724402694404, duration: 86400000 },
  { endTime: 1724489094404, duration: 86400000 },
  { endTime: 1724575494404, duration: 86400000 },
  { endTime: 1724661894404, duration: 86400000 },
  { endTime: 1724748294404, duration: 86400000 },
];

const IncidentsPage = ({
  customDataSource,
  defaultTimespan = parsePrometheusDuration('7d'),
  namespace,
  timespan,
}) => {
  const [startingDate, setStartingDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [incidentsPageData, setIncidentsPageData] = React.useState([]);
  //raw data
  const [data, setData] = React.useState([]);
  //data that is mapped and changed from timestamps to a format HH/DD/MM/YY
  const [processedData, setProcessedData] = React.useState([]);
  //will be used to define the Xdomain of chart
  const [xDomain, setXDomain] = React.useState(twoWeeksDateRanges);
  const safeFetch = useSafeFetch();
  React.useEffect(() => {
    (async () => {
      try {
        const results = await Promise.all(
          twoWeeksDateRanges.map(async (range) => {
            const response = await safeFetch(
              getPrometheusURL(
                {
                  endpoint: PrometheusEndpoint.QUERY_RANGE,
                  endTime: range.endTime,
                  namespace,
                  query: 'ALERTS',
                  samples: 23,
                  timespan: range.duration - 1,
                },
                customDataSource?.basePath,
              ),
            );
            return response.data.result;
          }),
        );
        const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
        setData(aggregatedData);
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
        <IncidentsHeader alertsData={processedData} />
      </div>
    </>
  );
};

export default IncidentsPage;
