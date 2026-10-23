import { Alert, AlertActionCloseButton, AlertGroup } from '@patternfly/react-core';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { setAgentToast } from '../redux-actions';
import { State } from '../redux-reducers';
import { AIExperienceIcon } from './AIExperienceIcon';

const DISMISS_MS = 8000;

// Above the console's modal backdrop (~1050) so the toast is never hidden.
const TOAST_ZINDEX = 1060;

const AgentToast = () => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const dispatch = useDispatch();
  const toastMessage: string = useSelector((s: State) => s.plugins?.tp?.get('agentToast'));
  const dismiss = useCallback(() => dispatch(setAgentToast('')), [dispatch]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(dismiss, DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, dismiss]);

  if (!toastMessage) return null;

  return (
    <AlertGroup isToast isLiveRegion style={{ zIndex: TOAST_ZINDEX }}>
      <Alert
        variant="info"
        title={t('AI agent updating your view')}
        customIcon={<AIExperienceIcon />}
        actionClose={<AlertActionCloseButton onClose={dismiss} />}
      >
        {toastMessage}
      </Alert>
    </AlertGroup>
  );
};

export default AgentToast;
