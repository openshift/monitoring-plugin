import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { Label as PfLabel, LabelGroup as PfLabelGroup } from '@patternfly/react-core';
import { PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';

const Label = ({ k, v }: { k: string; v: string }) => (
  <PfLabel key={k}>
    <span>{k}</span>
    <span>=</span>
    <span>{v}</span>
  </PfLabel>
);

export const Labels = ({ labels }: { labels: PrometheusLabels }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return _.isEmpty(labels) ? (
    <div>{t('No labels')}</div>
  ) : (
    <PfLabelGroup numLabels={20}>
      {_.map(labels, (v, k) => (
        <Label key={k} k={k} v={v} />
      ))}
    </PfLabelGroup>
  );
};
