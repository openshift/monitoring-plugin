import React from 'react';

export const OlsToolUIPersesWrapper = ({ children, initialTimeRange }) => (
  <div data-testid="perses-wrapper" data-time-range={JSON.stringify(initialTimeRange)}>
    {children}
  </div>
);
