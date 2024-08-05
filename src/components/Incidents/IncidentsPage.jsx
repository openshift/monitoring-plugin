import * as React from 'react';
import { Helmet } from 'react-helmet';
import { IncidentsHeader } from './IncidentsHeader/IncidentsHeader';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { PrometheusEndpoint } from '@openshift-console/dynamic-plugin-sdk';
import { getTimeRanges } from '../utils';
import { parsePrometheusDuration } from '../console/utils/datetime';
import { getPrometheusURL } from '../console/graphs/helpers';
import { useDispatch } from 'react-redux';

const minSamples = 10;
const maxSamples = 300;
const minStep = 5 * 1000;
const getMaxSamplesForSpan = (span) =>
  _.clamp(Math.round(span / minStep), minSamples, maxSamples);
const spans = ['1d', '3d', '7d', '15d'];

const IncidentsPage = ({
  customDataSource,
  defaultTimespan = parsePrometheusDuration('7d'),
  defaultSamples,
  namespace,
  timespan,
  fixedXDomain
  }) => {
  const [startingDate, setStartingDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [incidentsPageData, setIncidentsPageData] = React.useState([])
  const defaultSpanText = spans.find((s) => parsePrometheusDuration(s) >= defaultTimespan);
  const [span, setSpan] = React.useState(timespan || parsePrometheusDuration(defaultSpanText));
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

  const queries = ['ALERTS']
  const queryPromises = _.map(queries, (query) => {
    if (_.isEmpty(query)) {
      return Promise.resolve([]);
    } else {
      const promiseMap = _.map(
        timeRanges,
        (timeRange) =>
          safeFetch(
            getPrometheusURL(
              {
                endpoint: PrometheusEndpoint.QUERY_RANGE,
                endTime: timeRange.endTime,
                namespace,
                query,
                samples: Math.ceil(samples / timeRanges.length),
                timeout: '60s',
                timespan: timeRange.duration - 1,
              },
              customDataSource?.basePath,
            ),
          ),
      );
      return Promise.all(promiseMap).then((responses) => {
        const results = _.map(responses, 'data.result');
        const combinedQueries = results.reduce(
          (accumulator, response) => {
            response.forEach((metricResult) => {
              const index = accumulator.findIndex(
                (item) => JSON.stringify(item.metric) === JSON.stringify(metricResult.metric),
              );
              if (index === -1) {
                accumulator.push(metricResult);
              } else {
                accumulator[index].values = accumulator[index].values.concat(metricResult.values);
              }
            });
            return accumulator;
          },
          [],
        );
        // Recombine into the original query to allow for the redux store and the things using
        // it (query duplication, ect) to be able to work. Grab the heading of the first response
        // for the status and structure of the response
        const queryResponse = responses.at(0);
        if (!queryResponse) {
          return [];
        }
        queryResponse.data.result = combinedQueries;
        return queryResponse;
      });
    }
  });

  Promise.all(queryPromises)
      .then((responses) => {
        const newResults = _.map(responses, 'data.result');
        const numDataPoints = _.sumBy(newResults, (r) => _.sumBy(r, 'values.length'));

        if (numDataPoints > maxDataPointsHard && samples === minSamples) {
          setIsDatasetTooBig(true);
          return;
        }
        setIsDatasetTooBig(false);

        const newSamples = _.clamp(
          Math.floor((samples * maxDataPointsSoft) / numDataPoints),
          minSamples,
          maxSamplesForSpan,
        );

        // Change `samples` if either
        //   - It will change by a proportion greater than `samplesLeeway`
        //   - It will change to the upper or lower limit of its allowed range
        if (
          Math.abs(newSamples - samples) / samples > samplesLeeway ||
          (newSamples !== samples &&
            (newSamples === maxSamplesForSpan || newSamples === minSamples))
        ) {
          setSamples(newSamples);
        } else {
          const newGraphData = _.map(
            newResults,
            (result, queryIndex) => {
              return _.map(result, ({ metric, values }) => {
                // If filterLabels is specified, ignore all series that don't match
                if (_.some(filterLabels, (v, k) => _.has(metric, k) && metric[k] !== v)) {
                  return [];
                } else {
                  let defaultEmptyValue = null;
                  if (isStack && _.some(values, (value) => Number.isNaN(Number(value[1])))) {
                    // eslint-disable-next-line no-console
                    console.warn(
                      'Invalid response values for stacked graph converted to 0 for query: ',
                      queries[queryIndex],
                    );
                    defaultEmptyValue = 0;
                  }
                  return [metric, formatSeriesValues(values, samples, span, defaultEmptyValue)];
                }
              });
            },
          );
          setGraphData(newGraphData);

          _.each(newResults, (r, i) =>
            dispatch(queryBrowserPatchQuery(i, { series: r ? _.map(r, 'metric') : undefined })),
          );
          setUpdating(false);
        }
        setError(undefined);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err);
          setUpdating(false);
        }
      });

  const dispatch = useDispatch();
  const queryForAlerts = React.useCallback(() => dispatch(queryBrowserRunQueries()), [dispatch]);

  return (
    <>
      <div className="co-m-pane__body">
        <IncidentsHeader />
      </div>
    </>
  );
};

export default IncidentsPage;
