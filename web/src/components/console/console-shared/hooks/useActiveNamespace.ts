import * as React from 'react';

type NamespaceContextType = {
  namespace?: string;
  setNamespace?: (ns: string) => void;
};

const NamespaceContext = React.createContext<NamespaceContextType>({});

export const useActiveNamespace = () => {
  const { namespace, setNamespace } = React.useContext(NamespaceContext);
  return [namespace, setNamespace];
};
