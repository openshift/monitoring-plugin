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
  Switch,
  TextInput,
  EmptyStateActions,
  EmptyStateHeader,
  EmptyStateFooter,
} from '@patternfly/react-core';
import fuzzysearch from 'fuzzysearch';
import { useTranslation } from 'react-i18next';
import { isSystemNamespace } from './filters';
import NamespaceMenuToggle from './NamespaceMenuToggle';
import './NamespaceDropdown.scss';
import { useFlag, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk-internal/lib/extensions/console-types';
import { ProjectModel } from '../../models';
import {
  LEGACY_DASHBOARDS_KEY,
  alphanumericCompare,
  FLAGS,
  NAMESPACE_LOCAL_STORAGE_KEY,
  NAMESPACE_USERSETTINGS_PREFIX,
} from './utils/utils';
import { useUserSettingsCompatibility } from './utils/useUserSettingsCompatibility';
export const NoResults: React.FC<{
  onClear: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}> = ({ onClear }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return (
    <>
      <Divider />
      <EmptyState>
        <EmptyStateHeader titleText={<>{t('No projects found')}</>} headingLevel="h4" />
        <EmptyStateBody>{t('No results match the filter criteria.')}</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button
              variant="link"
              onClick={onClear}
              className="co-namespace-selector__clear-filters"
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

const SystemSwitch: React.FC<{
  hasSystemNamespaces: boolean;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}> = ({ hasSystemNamespaces, isChecked, onChange }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return hasSystemNamespaces ? (
    <>
      <Divider />
      <MenuSearch>
        <MenuSearchInput>
          <Switch
            data-test="showSystemSwitch"
            data-checked-state={isChecked}
            label={t('Show default projects')}
            isChecked={isChecked}
            onChange={(_, value) => onChange(value)}
            className="pf-v5-c-select__menu-item pf-m-action co-namespace-dropdown__switch"
          />
        </MenuSearchInput>
      </MenuSearch>
    </>
  ) : null;
};

/* ****************************************** */

export const NamespaceGroup: React.FC<{
  isFavorites?: boolean;
  options: { key: string; title: string }[];
  selectedKey: string;
  favorites?: { [key: string]: boolean }[];
  canFavorite?: boolean;
}> = ({ isFavorites, options, selectedKey, favorites, canFavorite = true }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  let label = t('Projects');
  if (isFavorites) {
    label = t('Favorites');
  }

  return options.length === 0 ? null : (
    <>
      <Divider />
      <MenuGroup label={label}>
        <MenuList>
          {options.map((option) => {
            return (
              <MenuItem
                key={option.key}
                itemId={option.key}
                isFavorited={canFavorite ? !!favorites?.[option.key] : undefined}
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

const NamespaceMenu: React.FC<{
  setOpen: (isOpen: boolean) => void;
  onSelect: (event: React.MouseEvent, itemId: string) => void;
  selected?: string;
  legacyDashboardsTitle: string;
  menuRef: React.MutableRefObject<HTMLDivElement>;
}> = ({ setOpen, onSelect, selected, legacyDashboardsTitle, menuRef }) => {
  const filterRef = React.useRef(null);

  const [filterText, setFilterText] = React.useState('');

  // Bookmarking / favorites (note in <= 4.8 this feature was known as bookmarking)
  const favoritesUserSettingsKey = `${NAMESPACE_USERSETTINGS_PREFIX}.bookmarks`;
  const systemNamespacesSettingsKey = `${NAMESPACE_USERSETTINGS_PREFIX}.systemNamespace`;
  const favoriteStorageKey = `${NAMESPACE_LOCAL_STORAGE_KEY}-bookmarks`;
  const systemNamespaceKey = `${NAMESPACE_LOCAL_STORAGE_KEY}-systemNamespace`;
  const [favorites, setFavorites] = useUserSettingsCompatibility(
    favoritesUserSettingsKey,
    favoriteStorageKey,
    undefined,
    true,
  );

  const canList: boolean = useFlag(FLAGS.CAN_LIST_NS);
  const [options, optionsLoaded] = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: ProjectModel.kind,
    optional: true,
  });

  const optionItems = React.useMemo(() => {
    if (!optionsLoaded) {
      return [];
    }
    const items = options.map((item) => {
      const { name } = item.metadata;
      return { title: name, key: name };
    });
    if (!items.some((option) => option.title === selected) && selected !== LEGACY_DASHBOARDS_KEY) {
      items.push({ title: selected, key: selected }); // Add current namespace if it isn't included
    }
    items.sort((a, b) => alphanumericCompare(a.title, b.title));

    if (canList) {
      items.unshift({ title: legacyDashboardsTitle, key: LEGACY_DASHBOARDS_KEY });
    }
    return items;
  }, [legacyDashboardsTitle, canList, options, optionsLoaded, selected]);

  const hasSystemNamespaces = React.useMemo(
    () => optionItems.some((option) => isSystemNamespace(option)),
    [optionItems],
  );

  const onSetFavorite = React.useCallback(
    (key, active) => {
      setFavorites((oldFavorites) => ({
        ...oldFavorites,
        [key]: active ? true : undefined,
      }));
    },
    [setFavorites],
  );

  const [systemNamespaces, setSystemNamespaces] = useUserSettingsCompatibility(
    systemNamespacesSettingsKey,
    systemNamespaceKey,
    false,
    true,
  );

  const isFavorite = React.useCallback((option) => !!favorites?.[option.key], [favorites]);

  const isOptionShown = React.useCallback(
    (option, checkIsFavorite: boolean) => {
      const containsFilterText = fuzzysearch(filterText.toLowerCase(), option.title.toLowerCase());

      if (checkIsFavorite) {
        return containsFilterText && isFavorite(option);
      }
      return (
        containsFilterText &&
        (systemNamespaces || !isSystemNamespace(option)) &&
        (!checkIsFavorite || isFavorite(option))
      );
    },
    [filterText, isFavorite, systemNamespaces],
  );

  const { filteredOptions, filteredFavorites } = React.useMemo(
    () =>
      optionItems.reduce(
        (filtered, option) => {
          if (isOptionShown(option, false)) {
            filtered.filteredOptions.push(option);
          }
          if (isOptionShown(option, true)) {
            filtered.filteredFavorites.push(option);
          }
          return filtered;
        },
        { filteredOptions: [], filteredFavorites: [] },
      ),
    [isOptionShown, optionItems],
  );

  return (
    <Menu
      className="co-namespace-dropdown__menu"
      ref={menuRef}
      onSelect={(event: React.MouseEvent, itemId: string) => {
        setOpen(false);
        onSelect(event, itemId);
      }}
      onActionClick={(event: React.MouseEvent, itemID: string) => {
        const isCurrentFavorite = favorites?.[itemID];
        onSetFavorite(itemID, !isCurrentFavorite);
      }}
      activeItemId={selected}
      data-test="namespace-dropdown-menu"
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
        <NamespaceGroup
          isFavorites
          options={filteredFavorites}
          selectedKey={selected}
          favorites={favorites}
        />
        <SystemSwitch
          hasSystemNamespaces={hasSystemNamespaces}
          isChecked={systemNamespaces}
          onChange={setSystemNamespaces}
        />
        <NamespaceGroup options={filteredOptions} selectedKey={selected} favorites={favorites} />
      </MenuContent>
    </Menu>
  );
};

/* ****************************************** */

const NamespaceDropdown: React.FC<NamespaceDropdownProps> = ({
  disabled,
  onSelect,
  selected,
  shortCut,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const menuRef = React.useRef(null);
  const [isOpen, setOpen] = React.useState(false);
  const legacyDashboardsTitle = t('Legacy Dashboards');

  const title = selected === LEGACY_DASHBOARDS_KEY ? legacyDashboardsTitle : selected;

  const menuProps = {
    setOpen,
    onSelect,
    selected,
    legacyDashboardsTitle,
    menuRef,
    children: <></>,
  };

  return (
    <div className="co-namespace-dropdown">
      <NamespaceMenuToggle
        disabled={disabled}
        menu={<NamespaceMenu {...menuProps} />}
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

type NamespaceDropdownProps = {
  disabled?: boolean;
  onSelect?: (event: React.MouseEvent | React.ChangeEvent, value: string) => void;
  shortCut?: string;
  selected?: string;
};

export default NamespaceDropdown;
