import * as React from 'react';
import IncidentsChart from '../IncidentsChart/IncidentsChart';
import AlertsChart from '../AlertsChart/AlertsChart';

export const IncidentsHeader = ({ incidentsData, chartDays, theme }) => {
  return (
    <div>
      <IncidentsChart incidentsData={incidentsData} chartDays={chartDays} theme={theme} />
      <AlertsChart chartDays={chartDays} theme={theme} />
    </div>
  );
};
