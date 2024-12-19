import * as React from 'react';
import { useLocation } from 'react-router-dom';

export const useQueryParams = () => {
  const location = useLocation();
  return React.useMemo(() => new URLSearchParams(location.search), [location.search]);
};
