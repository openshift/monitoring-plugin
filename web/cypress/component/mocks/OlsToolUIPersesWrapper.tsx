import { OlsToolUIPersesWrapperProps } from '@/features/perses-dashboards/ols-tool-ui/helpers/OlsToolUIPersesWrapper';

export const OlsToolUIPersesWrapper = ({
  children,
  initialTimeRange,
  initialTimeZone = 'local',
}: OlsToolUIPersesWrapperProps) => (
  <div
    data-testid="perses-wrapper"
    data-time-range={JSON.stringify(initialTimeRange)}
    data-timezone={initialTimeZone}
  >
    {children}
  </div>
);
