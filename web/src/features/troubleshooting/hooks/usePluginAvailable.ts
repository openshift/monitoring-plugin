import { useEffect } from 'react';

import { useBoolean } from '@/features/troubleshooting/hooks/useBoolean';

export const usePluginAvailable = (pluginName: string): [boolean, boolean] => {
  const [isPluginAvailable, , setPluginAvailable, setPluginUnavailable] = useBoolean(false);
  const [loading, , , setCompleted] = useBoolean(true);

  useEffect(() => {
    fetch(`/api/plugins/${pluginName}/plugin-manifest.json`)
      .then((response) => (response.status === 200 ? setPluginAvailable() : setPluginUnavailable()))
      .catch(setPluginUnavailable)
      .finally(setCompleted);
  }, [pluginName, setPluginAvailable, setPluginUnavailable, setCompleted]);

  return [isPluginAvailable, loading];
};
