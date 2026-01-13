import React, { createContext, useContext, useState, ReactNode } from 'react';
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

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<ToastItem[]>([]);

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
      <AlertGroup hasAnimations isToast isLiveRegion>
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
