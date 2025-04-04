import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Label as PfLabel, LabelGroup as PfLabelGroup } from '@patternfly/react-core';

const Label = ({ k, v }) => (
  <PfLabel key={k}>
    <span>{k}</span>
    <span>=</span>
    <span>{v}</span>
  </PfLabel>
);

export const Labels = ({ kind, labels }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return _.isEmpty(labels) ? (
    <div>{t('No labels')}</div>
  ) : (
    <div>
      <PfLabelGroup numLabels={20}>
        {_.map(labels, (v, k) => (
          <Label key={k} k={k} v={v} />
        ))}
      </PfLabelGroup>
    </div>
  );
};
