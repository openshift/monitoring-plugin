import * as React from 'react';
import { AlertStateIcon } from '../alerting/AlertUtils';
import { Checkbox, Label } from '@patternfly/react-core';
import InfoCircleIcon from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { Td, Tr } from '@patternfly/react-table';
import { TableData } from '@openshift-console/dynamic-plugin-sdk';

const IncidentsTableRow =
  (alertsData) =>
  ({ obj }) => {
    //alerts is NEEDED it data will be used in expanded details
    return (
      <Tr>
        <Td>
          <Checkbox />
        </Td>
        <Td>{obj.component}</Td>
        <Td>
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
        </Td>
        <Td>
          <AlertStateIcon state={obj.alertstate} />
        </Td>
      </Tr>
    );
  };

export default IncidentsTableRow;
