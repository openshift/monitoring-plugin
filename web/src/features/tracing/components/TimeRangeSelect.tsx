import { Form, FormGroup } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { TimeRangeControls, useTimeZoneParams } from '@perses-dev/plugin-system';
import './TimeRangeSelect.css';

export const TimeRangeSelect = () => {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
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
