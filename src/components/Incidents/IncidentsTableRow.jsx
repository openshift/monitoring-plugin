import * as React from 'react';
import { AlertStateIcon } from '../alerting/AlertUtils';

const IncidentsTableRow =
  (alertsData) =>
  ({ obj }) => {
    return (
      <>
        <td>{obj.component}</td>
        <td>
          {obj.severity}
          {/* USE  SeverityIcon component*/}
        </td>
        <td>
          <AlertStateIcon state={obj.inactive === true ? 'silenced' : 'firing'} />
        </td>
      </>
    );
  };

export default IncidentsTableRow;
