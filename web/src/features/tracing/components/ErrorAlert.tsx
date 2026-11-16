import { Alert } from '@patternfly/react-core';

export function ErrorAlert({ error }: { error: Error }) {
  return (
    <Alert isInline title={error.name} variant="danger">
      {error.message}
    </Alert>
  );
}
