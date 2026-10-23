import {
  ActionGroup,
  ActionList,
  ActionListItem,
  Button,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  NumberInput,
  Select,
  SelectList,
  SelectOption,
  TextArea,
  TextInput,
  Tooltip,
  ValidatedOptions,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { FC, Ref, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useDomains } from '../hooks/useDomains';
import { Query } from '../korrel8r/types';
import { defaultSearch, Search, SearchType } from '../redux-actions';
import { HelpPopover } from './HelpPopover';

interface AdvancedSearchFormProps {
  search: Search;
  onSearch: (search: Search) => void;
  onClose: () => void;
}

export const AdvancedSearchForm: FC<AdvancedSearchFormProps> = ({ search, onSearch, onClose }) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const domains = useDomains();

  const [queryStr, setQueryStr] = useState(search.queryStr);
  const [searchType, setSearchType] = useState(search.searchType);
  const [depth, setDepth] = useState(search.depth ?? defaultSearch.depth);
  const [goal, setGoal] = useState(search.goal ?? '');
  const [limit, setLimit] = useState(search.limit ?? defaultSearch.limit);

  // Track whether fields have been edited by the user.
  const [queryTouched, setQueryTouched] = useState(false);
  const [goalTouched, setGoalTouched] = useState(false);
  const onDepthChange = (depth: number) =>
    setDepth(Math.max(1, Math.min(10, depth ?? defaultSearch.depth)));
  const onLimitChange = (limit: number) => setLimit(Math.max(1, limit || defaultSearch.limit));

  // Update state if search changes (e.g. Correlate button pressed externally).
  useEffect(() => {
    setQueryStr(search.queryStr);
    setSearchType(search.searchType);
    onDepthChange(search.depth);
    setGoal(search.goal ?? '');
    setLimit(search.limit ?? defaultSearch.limit);
    setQueryTouched(false);
    setGoalTouched(false);
  }, [search.queryStr, search.searchType, search.depth, search.goal, search.limit]);

  const queryError = useMemo((): Error | null => {
    try {
      domains.queryToLink(Query.parse(queryStr?.trim()));
      return null;
    } catch (err) {
      return err;
    }
  }, [queryStr, domains]);

  const classError = useMemo((): Error | null => {
    if (searchType !== SearchType.Goal) return null;
    try {
      domains.class(goal?.trim());
      return null;
    } catch (err) {
      return err;
    }
  }, [goal, searchType, domains]);

  // Show error styling only after the user has edited the field.
  const validatedOption = (touched: boolean, err: Error | null) => {
    if (!touched) return ValidatedOptions.default;
    return err ? ValidatedOptions.error : ValidatedOptions.success;
  };

  const isValid = useMemo(() => !queryError && !classError, [queryError, classError]);
  const hasChanged = useMemo(
    () =>
      search.searchType !== searchType ||
      search.queryStr !== queryStr ||
      search.depth !== depth ||
      search.goal !== goal ||
      search.limit !== limit,
    [
      search.searchType,
      search.queryStr,
      search.depth,
      search.goal,
      search.limit,
      searchType,
      queryStr,
      depth,
      goal,
      limit,
    ],
  );

  const [searchTypeSelectOpen, setSearchTypeSelectOpen] = useState(false);
  const handleSubmit = () => {
    if (isValid && hasChanged) onSearch({ ...search, queryStr, searchType, depth, goal, limit });
  };
  const handleEnter = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline
      handleSubmit();
    }
  };

  return (
    <Form
      label={t('Advanced Search')}
      onSubmit={(e) => {
        e.preventDefault(); // Prevent page reload
        handleSubmit();
      }}
    >
      <FormGroup
        label={t('Start Query')}
        labelInfo={t('Select starting data')}
        hasNoPaddingTop={true}
        labelHelp={
          <HelpPopover>
            <Trans t={t}>
              <p>Query to select the starting data for the search.</p>
              <p>
                The <code>[Correlate]</code> button fills in a query for the data shown in the main
                view. You can enter your own query.
              </p>
            </Trans>
          </HelpPopover>
        }
      >
        <Flex
          grow={{ default: 'grow' }}
          direction={{ default: 'row' }}
          alignItems={{ default: 'alignItemsCenter' }}
          spaceItems={{ default: 'spaceItemsSm' }}
        >
          <TextArea
            id="query-input"
            value={queryStr}
            onChange={(_event, value) => {
              setQueryStr(value);
              setQueryTouched(true);
            }}
            placeholder="domain:class:selector"
            onKeyDown={handleEnter}
            resizeOrientation="vertical"
            rows={2}
            validated={validatedOption(queryTouched, queryError)}
          />
        </Flex>
        {queryTouched && queryError && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                <p>{String(queryError.message)}</p>
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup
        label={t('Search Type')}
        labelInfo={t('Neighbours or Goal search')}
        hasNoPaddingTop={true}
        labelHelp={
          <HelpPopover>
            <Trans t={t}>
              <p>There are two types of correlation search:</p>
              <ul>
                <li>
                  <b>Neighbourhood</b>: Find all connected neighbours up to a maximum <i>depth</i>{' '}
                  (number of hops.)
                </li>
                <li>
                  <b>Goal</b>: Find paths to a selected <i>goal class</i>. Finds all shortest paths,
                  and some near-shortest paths.
                </li>
              </ul>
            </Trans>
          </HelpPopover>
        }
      >
        <Flex
          direction={{ default: 'row' }}
          alignItems={{ default: 'alignItemsCenter' }}
          spaceItems={{ default: 'spaceItemsSm' }}
        >
          <Select
            id="search-type"
            isOpen={searchTypeSelectOpen}
            selected={searchType}
            onSelect={(_e, value: string) => {
              setSearchType(value as SearchType);
              setSearchTypeSelectOpen(false);
            }}
            onOpenChange={setSearchTypeSelectOpen}
            toggle={(toggleRef: Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setSearchTypeSelectOpen(!searchTypeSelectOpen)}
                isExpanded={searchTypeSelectOpen}
              >
                {searchType === SearchType.Goal ? t('Goals') : t('Neighbours')}
              </MenuToggle>
            )}
          >
            <SelectList>
              <SelectOption value={SearchType.Depth}>{t('Neighbours')}</SelectOption>
              <SelectOption value={SearchType.Goal}>{t('Goals')}</SelectOption>
            </SelectList>
          </Select>
          {searchType === SearchType.Goal ? (
            <FlexItem grow={{ default: 'grow' }}>
              <TextInput
                id="goal-class-input"
                value={goal ?? ''}
                placeholder="domain:classname"
                onChange={(_e, value) => {
                  setGoal(value);
                  setGoalTouched(true);
                }}
                validated={validatedOption(goalTouched, classError)}
              />
              {goalTouched && classError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                      {String(classError.message)}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FlexItem>
          ) : (
            <NumberInput
              id="depth-input"
              value={depth}
              unit={'hops'}
              min={1}
              max={10}
              onPlus={() => onDepthChange(depth + 1)}
              onMinus={() => onDepthChange(depth - 1)}
              onChange={(e) => onDepthChange(Number((e.target as HTMLInputElement).value))}
              widthChars={2}
            />
          )}
        </Flex>
      </FormGroup>

      <FormGroup
        label={t('Max Results')}
        labelInfo={t('Per query limit')}
        hasNoPaddingTop={true}
        labelHelp={
          <HelpPopover>
            <Trans t={t}>
              <p>Maximum number of results to return from each query in the correlation search.</p>
            </Trans>
          </HelpPopover>
        }
      >
        <NumberInput
          id="max-results"
          value={limit}
          min={1}
          onPlus={() => onLimitChange(limit + 1)}
          onMinus={() => onLimitChange(limit - 1)}
          onChange={(e) => onLimitChange(Number((e.target as HTMLInputElement).value))}
          widthChars={4}
        />
      </FormGroup>

      <ActionGroup>
        <ActionList>
          <ActionListItem>
            <Tooltip
              content={
                !isValid
                  ? t('Fix validation errors before searching')
                  : hasChanged
                    ? t('Update the correlation graph')
                    : t('Correlation graph already matches search')
              }
            >
              <Button type="submit" variant="primary" isAriaDisabled={!hasChanged || !isValid}>
                {t('Search')}
              </Button>
            </Tooltip>
          </ActionListItem>
          <ActionListItem>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('Close')}
            </Button>
          </ActionListItem>
        </ActionList>
      </ActionGroup>
    </Form>
  );
};
