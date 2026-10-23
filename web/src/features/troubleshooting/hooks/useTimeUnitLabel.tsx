import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Unit } from '@/features/troubleshooting/utils/time';

/** Returns a function that maps a Unit to its translated label (e.g. "minutes"). */
export const useTimeUnitLabel = (): ((u: Unit) => string) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return useCallback(
    (u: Unit): string => {
      switch (u) {
        case Unit.SECOND:
          return t('seconds');
        case Unit.MINUTE:
          return t('minutes');
        case Unit.HOUR:
          return t('hours');
        case Unit.DAY:
          return t('days');
        case Unit.WEEK:
          return t('weeks');
        default:
          return '';
      }
    },
    [t],
  );
};
