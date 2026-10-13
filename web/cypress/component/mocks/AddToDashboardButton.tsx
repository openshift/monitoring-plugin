export const AddToDashboardButton = ({ query, name, description }) => (
  <button
    data-testid="add-to-dashboard"
    data-name={name}
    data-query={query}
    data-description={description}
  />
);
