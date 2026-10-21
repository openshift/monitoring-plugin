import { getAlertingRules } from '@/features/logging/utils/get-alerting-rules';

const getPlatformAlertingRules = (namespace?: string) =>
  getAlertingRules(['infrastructure', 'audit'], namespace);

export default getPlatformAlertingRules;
