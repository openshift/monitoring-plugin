import * as React from 'react';
import IncidentsChart from '../IncidentsChart/IncidentsChart';
import AlertsChart from '../AlertsChart/AlertsChart';

export const IncidentsHeader = ({
  alertsData,
  incidentsData,
  chartDays,
  chooseIncident,
  tableLoaded,
}) => {
  return (
    <div className="incidents-chart-card-container">
      <IncidentsChart
        incidentsData={incidentsData}
        chartDays={chartDays}
        chooseIncident={chooseIncident}
        tableLoaded={tableLoaded}
      />
      <AlertsChart alertsData={alertsData} chartDays={chartDays} />
    </div>
  );
};
