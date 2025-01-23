import * as React from 'react';
import { Alert } from '@patternfly/react-core';

const ErrorAlert: React.FC<{ error: Error }> = ({ error }) => {
  return (
    <Alert isInline className="co-alert co-alert--scrollable" title={error.name} variant="danger">
      {error.message}
    </Alert>
  );
};

export default ErrorAlert;
