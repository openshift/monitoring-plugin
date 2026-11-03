/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { FC } from 'react';

import { AdvancedSearchForm } from '@/features/troubleshooting/components/AdvancedSearchForm';
import { defaultSearch, Search, SearchType } from '@/features/troubleshooting/store/actions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/troubleshooting/hooks/useDomains', () => ({
  useDomains: () => ({
    queryToLink: () => ({}),
    class: () => ({}),
  }),
}));

const search: Search = {
  ...defaultSearch,
  queryStr: 'k8s:Pod:{}',
  searchType: SearchType.Depth,
};

const Wrapper: FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

const renderForm = (onSearch: (s: Search) => void) =>
  render(
    <Wrapper>
      <AdvancedSearchForm search={search} onSearch={onSearch} onClose={() => {}} />
    </Wrapper>,
  );

const queryInput = () => screen.getByPlaceholderText('domain:class:selector');

const searchButton = () => screen.getByRole('button', { name: 'Search' });

describe('AdvancedSearchForm', () => {
  it('disables Search when only whitespace is added to the current query', () => {
    renderForm(() => {});

    // A different query enables the button.
    fireEvent.change(queryInput(), { target: { value: 'k8s:Pod:{"a":"b"}' } });
    expect(searchButton().getAttribute('aria-disabled')).toBeNull();

    // Whitespace around the current query is not a change.
    fireEvent.change(queryInput(), {
      target: { value: '  k8s:Pod:{}  ' },
    });
    expect(searchButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('submits trimmed query values', () => {
    const onSearch = vi.fn();
    renderForm(onSearch);

    fireEvent.change(queryInput(), {
      target: { value: '  k8s:Pod:{}  ' },
    });
    // Enable the button with a real change.
    fireEvent.change(queryInput(), {
      target: { value: 'k8s:Pod:{"a":"b"}  ' },
    });
    fireEvent.click(searchButton());

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ queryStr: 'k8s:Pod:{"a":"b"}' }),
    );
  });
});
