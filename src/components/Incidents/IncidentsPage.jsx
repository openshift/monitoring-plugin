import * as React from 'react';
import { Helmet } from 'react-helmet';
import { withFallback } from '../console/console-shared/error/error-boundary';
import { IncidentsHeader } from './IncidentsHeader/IncidentsHeader';

const IncidentsPage = () => {
  return (
    <>
      <div className="co-m-pane__body">
        <IncidentsHeader />
      </div>
    </>
  );
};

export default IncidentsPage;
