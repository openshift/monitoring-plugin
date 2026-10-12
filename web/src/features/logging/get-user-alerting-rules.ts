import { getAlertingRules } from '@/features/logging/get-alerting-rules';

const getUserAlertingRules = (namespace?: string) => getAlertingRules(['application'], namespace);

export default getUserAlertingRules;
