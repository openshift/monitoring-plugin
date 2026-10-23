import { createContext, FC, PropsWithChildren } from 'react';
import AgentToast from './AgentToast';

const NullContext = createContext(null);

const NullContextProvider: FC<PropsWithChildren<{ value?: unknown }>> = ({ children, value }) => (
  <NullContext.Provider value={value}>
    {children}
    <AgentToast />
  </NullContext.Provider>
);

export default NullContextProvider;
