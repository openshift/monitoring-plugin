import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { getAllQueryArguments } from '../console/utils/router';
import { SilenceForm } from './SilenceForm';

const CreateSilencePage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const matchers = _.map(getAllQueryArguments(), (value, name) => ({
    name,
    value,
    isRegex: false,
  }));

  return _.isEmpty(matchers) ? (
    <SilenceForm defaults={{}} title={t('Create silence')} />
  ) : (
    <SilenceForm defaults={{ matchers }} title={t('Silence alert')} />
  );
};

export default CreateSilencePage;
