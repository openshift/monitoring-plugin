import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertProps,
  AlertGroup,
  AlertActionCloseButton,
  AlertVariant,
} from '@patternfly/react-core';

interface ToastItem {
  key: string;
  title: string;
  variant: AlertProps['variant'];
}

interface ToastContextType {
  addAlert: (title: string, variant: AlertProps['variant']) => void;
  removeAlert: (key: string) => void;
  alerts: ToastItem[];
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error(t('useToast must be used within ToastProvider'));
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = React.useState<ToastItem[]>([]);

  const addAlert = (title: string, variant: AlertProps['variant']) => {
    const key = new Date().getTime().toString();
    setAlerts((prevAlerts) => [{ title, variant, key }, ...prevAlerts]);
  };

  const removeAlert = (key: string) => {
    setAlerts((prevAlerts) => prevAlerts.filter((alert) => alert.key !== key));
  };

  return (
    <ToastContext.Provider value={{ addAlert, removeAlert, alerts }}>
      {children}
      <AlertGroup isToast isLiveRegion>
        {alerts.map(({ key, variant, title }) => (
          <Alert
            variant={AlertVariant[variant]}
            title={title}
            actionClose={
              <AlertActionCloseButton
                title={title}
                variantLabel={`${variant} alert`}
                onClose={() => removeAlert(key)}
              />
            }
            key={key}
          />
        ))}
      </AlertGroup>
    </ToastContext.Provider>
  );
};
