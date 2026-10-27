import type { AddToDashboardButtonProps } from '@/features/perses-dashboards/ols-tool-ui/helpers/AddToDashboardButton';

export const AddToDashboardButton = ({ query, name, description }: AddToDashboardButtonProps) => (
  <button
    data-test="add-to-dashboard"
    data-name={name}
    data-query={query}
    data-description={description}
  />
);
