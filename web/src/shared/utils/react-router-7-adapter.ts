import { useNavigate, useLocation } from 'react-router';
import { QueryParamAdapter, QueryParamAdapterComponent } from 'use-query-params';

export const ReactRouter7Adapter: QueryParamAdapterComponent = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const adapter: QueryParamAdapter = {
    replace(location) {
      navigate(location.search || '?', {
        replace: true,
        state: location.state,
      });
    },
    push(location) {
      navigate(location.search || '?', {
        replace: false,
        state: location.state,
      });
    },
    get location() {
      return location;
    },
  };

  return children(adapter);
};
