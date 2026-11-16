import { Alert, AlertActionCloseButton, AlertProps } from '@patternfly/react-core';
import { useCallback, useState } from 'react';

export function ClosableAlert(props: AlertProps) {
  const [isVisible, setVisible] = useState(true);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  if (!isVisible) {
    return null;
  }

  return <Alert {...props} actionClose={<AlertActionCloseButton onClose={handleClose} />} />;
}
