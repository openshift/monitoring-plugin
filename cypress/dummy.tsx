import * as React from 'react';

export {
  ActionServiceProvider,
  BlueInfoCircleIcon,
  GreenCheckCircleIcon,
  ListPageBody,
  ListPageHeader,
  Overview,
  PrometheusEndpoint,
  RedExclamationCircleIcon,
  ResourceLink,
  ResourceStatus,
  useK8sWatchResource,
  usePrometheusPoll,
  YellowExclamationTriangleIcon,
} from '@openshift-console/dynamic-plugin-sdk';

export const consoleFetchJSON = (url) => fetch(url)
  .then(response => response.json());
consoleFetchJSON.delete = (url) => fetch(url, { method: 'DELETE' })
  .then(response => response.json());
consoleFetchJSON.post = (url, json) => fetch(url, { body: JSON.stringify(json), method: 'POST'})
  .then(response => response.json());

export const ListPageFilter = () => <input data-test="name-filter-input"></input>;

export const VirtualizedTable = ({ data, Row }) => (
  <table>
    <tbody>
      <tr data-test-rows="resource-row">
        {data.map((obj, i) => <Row key={i} obj={obj} />)}
      </tr>
    </tbody>
  </table>
);

export const Timestamp = () => <div>Mock_Timestamp</div>;

export const useActivePerspective = () => ['admin'];
export const useListPageFilter = (data, rowFilters) => [data, data, () => {}];
