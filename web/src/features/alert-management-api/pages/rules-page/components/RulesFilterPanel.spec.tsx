/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { RulesFilterPanel } from '@/features/alert-management-api/pages/rules-page/components/RulesFilterPanel';
import * as ruleFilterOptions from '@/features/alert-management-api/pages/rules-page/utils/rule-filter-options';
import { defaultRuleFilters } from '@/features/alert-management-api/pages/rules-page/utils/rules';
import { makeManagedRule } from '@/features/alert-management-api/tests/utils/object-factories';

const translation = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? name),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => translation }));

it('updates severity using rule-specific controls and preserves other filters', () => {
  const onChange = vi.fn();
  const filters = { ...defaultRuleFilters, namespace: ['payments'] };
  render(
    <RulesFilterPanel
      rules={[makeManagedRule({ severity: 'critical' })]}
      filters={filters}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Filter critical rules' }));

  expect(onChange).toHaveBeenCalledWith({ ...filters, severity: ['critical'] });
});

it('keeps a selected scope active until another scope or All is chosen', () => {
  const onChange = vi.fn();
  const filters = { ...defaultRuleFilters, scope: ['Cluster'], severity: ['critical'] };
  render(
    <RulesFilterPanel
      rules={[makeManagedRule()]}
      filters={filters}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Cluster' }));

  expect(onChange).toHaveBeenLastCalledWith(filters);

  fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));

  expect(onChange).toHaveBeenLastCalledWith({ ...filters, scope: ['Namespace'] });

  fireEvent.click(screen.getByRole('button', { name: 'All' }));

  expect(onChange).toHaveBeenLastCalledWith({ ...filters, scope: [] });
});

it('reuses options for filter changes and recomputes them for rules or translation changes', () => {
  const getOptions = vi.spyOn(ruleFilterOptions, 'getRuleFilterOptions');
  const props = {
    rules: [makeManagedRule()],
    filters: defaultRuleFilters,
    onChange: vi.fn(),
    onClose: vi.fn(),
  };
  const { rerender } = render(<RulesFilterPanel {...props} />);
  expect(getOptions).toHaveBeenCalledTimes(1);

  rerender(
    <RulesFilterPanel {...props} filters={{ ...defaultRuleFilters, enablement: ['Enabled'] }} />,
  );
  expect(getOptions).toHaveBeenCalledTimes(1);

  const rules = [...props.rules, makeManagedRule({ namespace: 'payments' })];
  rerender(<RulesFilterPanel {...props} rules={rules} />);
  expect(getOptions).toHaveBeenCalledTimes(2);

  translation.t = (key: string) => `translated:${key}`;
  rerender(<RulesFilterPanel {...props} rules={rules} />);
  expect(getOptions).toHaveBeenCalledTimes(3);
  getOptions.mockRestore();
});
