import * as React from 'react';
import IncidentsChart from '../IncidentsChart/IncidentsChart';
import AlertsChart from '../AlertsChart/AlertsChart';

export const IncidentsHeader = ({ alertsData, incidentsData, chartDays }) => {
  return (
    <div className="incidents-chart-card-container">
      <IncidentsChart incidentsData={incidentsData} chartDays={chartDays} />
      <AlertsChart alertsData={alertsData} chartDays={chartDays} />
    </div>
  );
};
