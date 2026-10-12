import { createContext, FC, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { defaultConfig, getConfig } from '@/features/logging/backend-client';
import { Config } from '@/features/logging/logs-types';

interface LogsContextType {
  config: Config;
  configLoaded: boolean;
}

export const LogsContext = createContext<LogsContextType | undefined>(undefined);

export const LogsConfigProvider: FC<{ children?: ReactNode | undefined }> = ({ children }) => {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await getConfig();
        const mergedConfig = { ...defaultConfig, ...configData };
        setConfig(mergedConfig);
        setConfigLoaded(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching logging plugin configuration', error);
        setConfig(defaultConfig);
        setConfigLoaded(true);
      }
    };

    loadConfig();
  }, []);

  const contextValue = useMemo(() => ({ config, configLoaded }), [config, configLoaded]);

  return <LogsContext.Provider value={contextValue}>{children}</LogsContext.Provider>;
};

export const useLogsConfig = (): LogsContextType => {
  const context = useContext(LogsContext);

  if (context === undefined) {
    throw new Error('useLogsConfig must be used within a LogsConfigProvider');
  }

  return context;
};
