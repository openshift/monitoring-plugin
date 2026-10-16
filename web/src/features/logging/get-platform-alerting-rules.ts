import { getAlertingRules } from '@/features/logging/get-alerting-rules';

const getPlatformAlertingRules = (namespace?: string) =>
  getAlertingRules(['infrastructure', 'audit'], namespace);

export default getPlatformAlertingRules;
