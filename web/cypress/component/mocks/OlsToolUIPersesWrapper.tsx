export const OlsToolUIPersesWrapper = ({
  children,
  initialTimeRange,
  initialTimeZone = 'local',
}) => (
  <div
    data-testid="perses-wrapper"
    data-time-range={JSON.stringify(initialTimeRange)}
    data-timezone={initialTimeZone}
  >
    {children}
  </div>
);
