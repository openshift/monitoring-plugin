import { page } from 'vitest/browser';

import { DataTestIDs } from '@/shared/constants/data-test';

export const summaryCard = (id: string) =>
  page.getByTestId(`${DataTestIDs.OverviewPage.SummaryCard}-${id}`);

export const capabilityCard = (id: string) =>
  page.getByTestId(`${DataTestIDs.OverviewPage.CapabilityCard}-${id}`);
