import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { useSafeFetch } from '../console/utils/safe-fetch-hook';

import { useBoolean } from '../hooks/useBoolean';
import { Board } from './types';

import { mockUseFetchDashboards } from './mock-monitoring-dashboard-config-response';

export const useFetchDashboards = (namespace: string): [Board[], boolean, string] => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [error, setError] = React.useState<string>();
  const [isLoading, , , setLoaded] = useBoolean(true);

  // console.log(`useFetchDashboards hostname: ${window.location.hostname}`);

  React.useEffect(() => {
    // if (window.location.host === 'localhost') {
    const [mockBoards, mockError] = mockUseFetchDashboards(namespace);
    setBoards(mockBoards);
    setLoaded();
    setError(mockError);

    // console.log('useFetchDashboards: mocking');

    // } else {
    //   safeFetch('/api/console/monitoring-dashboard-config')
    //   .then((response) => {
    //     setLoaded();
    //     setError(undefined);
    //     let items = response.items;
    //     if (namespace) {
    //       items = _.filter(
    //         items,
    //         (item) => item.metadata?.labels['console.openshift.io/odc-dashboard'] === 'true',
    //       );
    //     }

    //     const getBoardData = (item): Board => {
    //       try {
    //         return {
    //           data: JSON.parse(_.values(item.data)[0]),
    //           name: item.metadata.name,
    //         };
    //       } catch (e) {
    //         setError(
    //           t('Could not parse JSON data for dashboard "{{dashboard}}"', {
    //             dashboard: item.metadata.name,
    //           }),
    //         );
    //         return { data: undefined, name: item?.metadata?.name };
    //       }
    //     };

    //     const newBoards = _.sortBy(_.map(items, getBoardData), (v) => _.toLower(v?.data?.title));
    //     setBoards(newBoards);
    //   })
    //   .catch((err) => {
    //     setLoaded();
    //     if (err.name !== 'AbortError') {
    //       setError(_.get(err, 'json.error', err.message));
    //     }
    //   });
    // }
  }, [namespace, safeFetch, setLoaded, t]);

  return [boards, isLoading, error];
};
