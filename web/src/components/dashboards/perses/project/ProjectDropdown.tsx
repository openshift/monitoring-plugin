import * as React from 'react';
import {
  Button,
  Divider,
  EmptyState,
  EmptyStateBody,
  Menu,
  MenuContent,
  MenuGroup,
  MenuSearch,
  MenuSearchInput,
  MenuItem,
  MenuList,
  TextInput,
  EmptyStateActions,
  EmptyStateFooter,
} from '@patternfly/react-core';
import fuzzysearch from 'fuzzysearch';
import { useTranslation } from 'react-i18next';
import ProjectMenuToggle from './ProjectMenuToggle';
import './ProjectDropdown.scss';
import { alphanumericCompare } from './utils';
import { usePerses } from '../hooks/usePerses';

export const NoResults: React.FC<{
  onClear: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}> = ({ onClear }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return (
    <>
      <Divider />
      <EmptyState  headingLevel="h4"   titleText={<>{t('No projects found')}</>}>
        <EmptyStateBody>{t('No results match the filter criteria.')}</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button
              variant="link"
              onClick={onClear}
              className="monitoring__project-selector__clear-filters"
            >
              {t('Clear filters')}
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    </>
  );
};

/* ****************************************** */

export const Filter: React.FC<{
  filterRef: React.Ref<any>;
  onFilterChange: (filterText: string) => void;
  filterText: string;
}> = ({ filterText, filterRef, onFilterChange }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return (
    <MenuSearch>
      <MenuSearchInput>
        <TextInput
          data-test="dropdown-text-filter"
          autoFocus
          value={filterText}
          aria-label={t('Select project...')}
          type="search"
          placeholder={t('Select project...')}
          onChange={(_, value: string) => onFilterChange(value)}
          ref={filterRef}
        />
      </MenuSearchInput>
    </MenuSearch>
  );
};

/* ****************************************** */

export const ProjectGroup: React.FC<{
  options: { key: string; title: string }[];
  selectedKey: string;
}> = ({ options, selectedKey }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return options.length === 0 ? null : (
    <>
      <Divider />
      <MenuGroup label={t('Projects')}>
        <MenuList>
          {options.map((option) => {
            return (
              <MenuItem
                key={option.key}
                itemId={option.key}
                isSelected={selectedKey === option.key}
                data-test="dropdown-menu-item-link"
              >
                {option.title}
              </MenuItem>
            );
          })}
        </MenuList>
      </MenuGroup>
    </>
  );
};

/* ****************************************** */

const ProjectMenu: React.FC<{
  setOpen: (isOpen: boolean) => void;
  onSelect: (event: React.MouseEvent, itemId: string) => void;
  selected?: string;
  menuRef: React.MutableRefObject<HTMLDivElement>;
}> = ({ setOpen, onSelect, selected, menuRef }) => {
  const filterRef = React.useRef(null);

  const [filterText, setFilterText] = React.useState('');

  const { persesProjects } = usePerses();

  const optionItems = React.useMemo(() => {
    const items = persesProjects.map((item) => {
      const { name } = item.metadata;
      return { title: item?.spec?.display?.name ?? name, key: name };
    });

    if (!items.some((option) => option.key === selected)) {
      items.push({ title: selected, key: selected }); // Add current project if it isn't included
    }
    items.sort((a, b) => alphanumericCompare(a.title, b.title));

    return items;
  }, [persesProjects, selected]);

  const isOptionShown = React.useCallback(
    (option) => {
      return fuzzysearch(filterText.toLowerCase(), option.title.toLowerCase());
    },
    [filterText],
  );

  const { filteredOptions } = React.useMemo(
    () =>
      optionItems.reduce(
        (filtered, option) => {
          if (isOptionShown(option)) {
            filtered.filteredOptions.push(option);
          }
          return filtered;
        },
        { filteredOptions: [] },
      ),
    [isOptionShown, optionItems],
  );

  return (
    <Menu
      className="monitoring__project-dropdown__menu"
      ref={menuRef}
      onSelect={(event: React.MouseEvent, itemId: string) => {
        setOpen(false);
        onSelect(event, itemId);
      }}
      activeItemId={selected}
      data-test="project-dropdown-menu"
      isScrollable
    >
      <MenuContent maxMenuHeight="60vh">
        <Filter filterRef={filterRef} onFilterChange={setFilterText} filterText={filterText} />
        {filteredOptions.length === 0 ? (
          <NoResults
            onClear={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setFilterText('');
              filterRef.current?.focus();
            }}
          />
        ) : null}
        <ProjectGroup options={filteredOptions} selectedKey={selected} />
      </MenuContent>
    </Menu>
  );
};

/* ****************************************** */

const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
  disabled,
  onSelect,
  selected,
  shortCut,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const menuRef = React.useRef(null);
  const [isOpen, setOpen] = React.useState(false);
  const { persesProjectsError, persesProjectsLoading, persesProjects } = usePerses();

  // const title = selected === LEGACY_DASHBOARDS_KEY ? legacyDashboardsTitle : selected;

  const menuProps = {
    setOpen,
    onSelect,
    selected,
    menuRef,
  };

  if (persesProjectsLoading || persesProjectsError || persesProjects.length === 0) {
    return null;
  }

  const selectedProject = persesProjects.find(
    (persesProject) => persesProject.metadata.name === selected,
  );
  const title = selectedProject?.spec?.display?.name ?? t('Dashboards');

  return (
    <div className="monitoring__project-dropdown">
      <ProjectMenuToggle
        disabled={disabled}
        menu={<ProjectMenu {...menuProps} />}
        menuRef={menuRef}
        isOpen={isOpen}
        title={`${t('Project')}: ${title}`}
        onToggle={(menuState) => {
          setOpen(menuState);
        }}
        shortCut={shortCut}
      />
    </div>
  );
};

type ProjectDropdownProps = {
  disabled?: boolean;
  onSelect?: (event: React.MouseEvent | React.ChangeEvent, value: string) => void;
  shortCut?: string;
  selected?: string;
};

export default ProjectDropdown;
