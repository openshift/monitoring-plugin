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

const twoWeeksDateRanges = [
  /* {
    endTime: 1723034984857,
    duration: 86400000,
  },
  {
    endTime: 1723121384857,
    duration: 86400000,
  },
  {
    endTime: 1723207784857,
    duration: 86400000,
  },
  {
    endTime: 1723294184857,
    duration: 86400000,
  },
  {
    endTime: 1723380584857,
    duration: 86400000,
  },
  {
    endTime: 1723466984857,
    duration: 86400000,
  },
  {
    endTime: 1723553384857,
    duration: 86400000,
  },
  {
    endTime: 1723639784857,
    duration: 86400000,
  },
  {
    endTime: 1723726184857,
    duration: 86400000,
  },
  {
    endTime: 1723812584857,
    duration: 86400000,
  },
  {
    endTime: 1723898984857,
    duration: 86400000,
  },
  {
    endTime: 1723985384857,
    duration: 86400000,
  },
  {
    endTime: 1724071784857,
    duration: 86400000,
  }, */
  {
    endTime: 1724158184857,
    duration: 86400000,
  },
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
  const defaultSpanText = spans.find((s) => parsePrometheusDuration(s) >= defaultTimespan);
  const [span, setSpan] = React.useState(timespan || parsePrometheusDuration(defaultSpanText));
  //raw data
  const [data, setData] = React.useState([]);
  //data that is mapped and changed from timestamps to a format HH/DD/MM/YY
  const [processedData, setProcessedData] = React.useState([]);
  //will be used to define the Xdomain of chart
  const [xDomain, setXDomain] = React.useState(twoWeeksDateRanges);
  const safeFetch = useSafeFetch();
  //this query makes requst for 1 day, to make request for several days
  //I need to repeat the request and reduce the results
  React.useEffect(() => {
    const results = []
    xDomain.map((async () => {
      try {
        const response = await safeFetch(
          getPrometheusURL(
            {
              endpoint: PrometheusEndpoint.QUERY_RANGE,
              endTime: 1723034984857,
              namespace,
              query: 'ALERTS',
              samples: 23,
              timespan: 86400000-1,
            },
            customDataSource?.basePath,
          ),
        );
        results.push(response.data.result);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err);
      }
      setData(results.flat(1));
    }));
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
