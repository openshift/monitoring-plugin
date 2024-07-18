import * as React from 'react';
import { Helmet } from 'react-helmet';
import { withFallback } from '../console/console-shared/error/error-boundary';
import { IncidentsHeader } from './IncidentsHeader/IncidentsHeader';

const mockViewport = {
  start: new Date(2024, 8, 19),
  end: new Date(2024, 8, 25),
};

const IncidentsPage = () => {
  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <div className="co-m-pane__body">
        <IncidentsHeader />
      </div>
    </>
  );
};

export default withFallback(IncidentsPage);
