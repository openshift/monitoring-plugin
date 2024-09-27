import * as React from 'react';
import { AlertStateIcon } from '../alerting/AlertUtils';
import { Label } from '@patternfly/react-core';
import InfoCircleIcon from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';

const IncidentsTableRow =
  (alertsData) =>
  ({ obj }) => {
    //alerts is NEEDED it data will be used in expanded details
    return (
      <>
        <td>{obj.component}</td>
        <td>
          {obj.critical > 0 ? (
            <Label color="red" icon={<InfoCircleIcon />}>
              {obj.critical}
            </Label>
          ) : (
            ''
          )}
          {obj.warning > 0 ? (
            <Label color="gold" icon={<InfoCircleIcon />}>
              {obj.warning}
            </Label>
          ) : (
            ''
          )}
          {obj.info > 0 ? (
            <Label color="blue" icon={<InfoCircleIcon />}>
              {obj.info}
            </Label>
          ) : (
            ''
          )}
        </td>
        <td>
          <AlertStateIcon state={obj.alertstate} />
        </td>
      </>
    );
  };

export default IncidentsTableRow;
