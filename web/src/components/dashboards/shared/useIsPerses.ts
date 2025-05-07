import React, { useContext } from 'react';

export const PersesContext = React.createContext(false);

export const useIsPerses = () => {
  const isPerses = useContext(PersesContext);
  return isPerses;
};
