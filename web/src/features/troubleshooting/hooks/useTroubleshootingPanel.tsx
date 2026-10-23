import { Action, ExtensionHook, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { InfrastructureIcon } from '@patternfly/react-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { openTP } from '../redux-actions';

const useTroubleshootingPanel: ExtensionHook<Array<Action>> = () => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const [perspective] = useActivePerspective();
  const dispatch = useDispatch();
  const open = useCallback(() => {
    dispatch(openTP());
  }, [dispatch]);

  const getActions = useCallback(() => {
    if (perspective !== 'admin') {
      return [];
    }
    const actions = [
      {
        id: 'open-troubleshooting-panel',
        label: (
          <div title={t('Open the Troubleshooting Panel')}>
            <InfrastructureIcon /> {t('Troubleshooting Panel')}
          </div>
        ),
        description: t('Open the Troubleshooting Panel'),
        cta: open,
        disabled: false,
        tooltip: t('Open the Troubleshooting Panel'),
      },
    ];
    return actions;
  }, [open, t, perspective]);

  const [actions, setActions] = useState<Array<Action>>(getActions());

  useEffect(() => {
    setActions(getActions());
  }, [open, getActions]);

  return [actions, true, null];
};

export default useTroubleshootingPanel;
