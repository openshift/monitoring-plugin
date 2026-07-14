import { AddToDashboardButtonProps } from '../../../src/features/perses-dashboards/ols-tool-ui/helpers/AddToDashboardButton';

export const AddToDashboardButton = ({ query, name, description }: AddToDashboardButtonProps) => (
  <button
    data-testid="add-to-dashboard"
    data-name={name}
    data-query={query}
    data-description={description}
  />
);
