import { useEffect } from 'react';
import { useBoolean } from './useBoolean';

export const usePluginAvailable = (pluginName: string): [boolean, boolean] => {
  const [isPluginAvailable, togglePluginAvailable] = useBoolean(false);
  const [loading, , , setCompleted] = useBoolean(true);

  useEffect(() => {
    fetch(`/api/plugins/${pluginName}/plugin-manifest.json`)
      .then((response) => {
        return response.status === 200 && togglePluginAvailable();
      })
      .finally(setCompleted);
  }, [togglePluginAvailable, pluginName, setCompleted]);

  return [isPluginAvailable, loading];
};
