import { Form, FormGroup } from '@patternfly/react-core';
import { TimeRangeControls, useTimeZoneParams } from '@perses-dev/plugin-system';
import { useTranslation } from 'react-i18next';
import '@/features/tracing/components/TimeRangeSelect.css';

export const TimeRangeSelect = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { timeZone, setTimeZone } = useTimeZoneParams('local');

  return (
    <Form className="dt-plugin-time-range-select">
      <FormGroup label={t('Time range')}>
        <TimeRangeControls
          showRefreshInterval={false}
          showRefreshButton={false}
          showZoomButtons={false}
          timeZone={timeZone}
          onTimeZoneChange={(tz) => setTimeZone(tz.value)}
        />
      </FormGroup>
    </Form>
  );
};
