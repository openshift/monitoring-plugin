import * as React from 'react';
import { useURLPoll } from './useURLPoll';

const URL_POLL_DEFAULT_DELAY = 60000; // 60 seconds

type features = {
  'acm-alerting': boolean;
  incidents: boolean;
};
type featuresResponse = {
  'acm-alerting'?: boolean;
  incidents?: boolean;
};

const noFeatures: features = {
  'acm-alerting': false,
  incidents: false,
};

export const useFeatures = () => {
  const [features, setFeatures] = React.useState<features>(noFeatures);

  const [response, loadError, loading] = useURLPoll<featuresResponse>(
    '/features',
    URL_POLL_DEFAULT_DELAY,
  );
  React.useEffect(() => {
    if (loadError) {
      setFeatures(noFeatures);
    } else if (!loading) {
      setFeatures({ ...noFeatures, ...response });
    }
  }, [loadError, loading, response, setFeatures]);

  return {
    features,
    acmAlertingActive: features['acm-alerting'],
    incidentsActive: features.incidents,
  };
};
