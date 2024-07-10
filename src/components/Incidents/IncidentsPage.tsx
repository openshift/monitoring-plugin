import * as React from 'react';
import { Helmet } from 'react-helmet';
import { withFallback } from '../console/console-shared/error/error-boundary';

const IncidentsPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
    </>
  );
};

export default withFallback(IncidentsPage);
