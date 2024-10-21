import * as React from 'react';
import IncidentsChart from '../IncidentsChart/IncidentsChart';
import AlertsChart from '../AlertsChart/AlertsChart';

export const IncidentsHeader = ({ alertsData, incidentsData, chartDays, onIncidentSelect }) => {
  return (
    <div className="incidents-chart-card-container">
      <IncidentsChart
        incidentsData={incidentsData}
        chartDays={chartDays}
        onIncidentSelect={onIncidentSelect}
      />
      <AlertsChart alertsData={alertsData} chartDays={chartDays} />
    </div>
  );
};
