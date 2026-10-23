import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { useEffect, useState } from 'react';

type Features = Record<string, boolean>;

const FEATURES_URL = '/api/plugins/troubleshooting-panel-console-plugin/features';

let featuresPromise: Promise<Features> | undefined;

const fetchFeatures = (): Promise<Features> =>
  (featuresPromise ??= consoleFetch(FEATURES_URL)
    .then((r) => r.json() as Promise<Features>)
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch features:', e);
      featuresPromise = undefined;
      return {};
    }));

export const useFeature = (name: string): boolean => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFeatures().then((features) => {
      if (!cancelled) setEnabled(!!features[name]);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return enabled;
};
