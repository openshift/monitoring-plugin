import { startCase as lodashStartCase } from 'lodash-es';

// add wrapper function to allow easier removal of lodash in the future
export const startCase = (value: string): string => lodashStartCase(value);
