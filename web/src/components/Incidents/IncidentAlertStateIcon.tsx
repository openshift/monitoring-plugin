import React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { BellIcon, CheckIcon, BellSlashIcon } from '@patternfly/react-icons';
import { GroupedAlert, IncidentsDetailsAlert } from './model';

interface IncidentAlertStateIconProps {
  alertDetails: IncidentsDetailsAlert;
  showTooltip?: boolean;
}

const getAlertState = (alertDetails: IncidentsDetailsAlert): 'firing' | 'resolved' | 'silenced' => {
  if (alertDetails.silenced) {
    return 'silenced';
  }
  if (alertDetails.resolved) {
    return 'resolved';
  }

  return 'firing';
};

export const IncidentAlertStateIcon: React.FC<IncidentAlertStateIconProps> = ({
  alertDetails,
  showTooltip = true,
}) => {
  const state = getAlertState(alertDetails);

  const getIconAndTooltip = () => {
    switch (state) {
      case 'firing':
        return {
          icon: <BellIcon />,
          tooltip: 'Firing',
        };
      case 'resolved':
        return {
          icon: <CheckIcon />,
          tooltip: 'Resolved',
        };
      case 'silenced':
        return {
          icon: <BellSlashIcon style={{ color: 'var(--pf-t--global--icon--color--disabled)' }} />,
          tooltip: 'Silenced',
        };
      default:
        return {
          icon: <BellIcon />,
          tooltip: 'Unknown',
        };
    }
  };

  const { icon, tooltip } = getIconAndTooltip();

  if (showTooltip) {
    return <Tooltip content={tooltip}>{icon}</Tooltip>;
  }

  return icon;
};

interface GroupedAlertStateIconProps {
  groupedAlert: GroupedAlert;
  showTooltip?: boolean;
}
const getGroupedAlertState = (groupedAlert: GroupedAlert): 'firing' | 'resolved' | 'silenced' => {
  if (groupedAlert.alertstate === 'silenced') {
    return 'silenced';
  }
  if (groupedAlert.alertstate === 'resolved') {
    return 'resolved';
  }
  return 'firing';
};

export const GroupedAlertStateIcon: React.FC<GroupedAlertStateIconProps> = ({
  groupedAlert,
  showTooltip = true,
}) => {
  const state = getGroupedAlertState(groupedAlert);

  const getIconAndTooltip = () => {
    switch (state) {
      case 'firing':
        return {
          icon: <BellIcon />,
          tooltip: 'Firing',
        };
      case 'resolved':
        return {
          icon: <CheckIcon />,
          tooltip: 'Resolved',
        };
      case 'silenced':
        return {
          icon: <BellSlashIcon style={{ color: 'var(--pf-t--global--icon--color--disabled)' }} />,
          tooltip: 'Silenced',
        };
      default:
        return {
          icon: <BellIcon />,
          tooltip: 'Unknown',
        };
    }
  };

  const { icon, tooltip } = getIconAndTooltip();

  if (showTooltip) {
    return <Tooltip content={tooltip}>{icon}</Tooltip>;
  }

  return icon;
};
