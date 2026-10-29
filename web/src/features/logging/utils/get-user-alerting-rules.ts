import { getAlertingRules } from '@/features/logging/utils/get-alerting-rules';

const getUserAlertingRules = (namespace?: string) => getAlertingRules(['application'], namespace);

export default getUserAlertingRules;
