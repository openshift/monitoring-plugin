import { useContext } from 'react';
import { PersesContext } from '../../router';

export const useIsPerses = () => {
  const isPerses = useContext(PersesContext);
  return isPerses;
};
