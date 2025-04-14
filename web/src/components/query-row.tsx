import React from 'react';
import { Fragment, useState } from 'react';
import {
  DataList,
  DataListItem,
  DataListItemRow,
  DataListCell,
  DataListAction,
  DataListToggle,
  DataListContent,
  DataListItemCells,
} from '@patternfly/react-core';

interface DataListProps {
  promQlexpressionInput: React.ReactNode;
  queryKebab: React.ReactNode;
  querySwitch: React.ReactNode;
  queryId: string;
  queryTable: React.ReactNode;
}

export const QueryRow: React.FunctionComponent<DataListProps> = ({
  queryKebab,
  querySwitch,
  promQlexpressionInput,
  queryId,
  queryTable,
}) => {
  const [expanded, setExpanded] = useState([]);
  const toggle = (id) => {
    const index = expanded.indexOf(id);
    const newExpanded =
      index >= 0
        ? [...expanded.slice(0, index), ...expanded.slice(index + 1, expanded.length)]
        : [...expanded, id];
    setExpanded(newExpanded);
  };

  return (
    <DataList aria-label="query-row">
      <DataListItem
        aria-labelledby="query-item-${queryId}"
        isExpanded={expanded.includes(`toggle-${queryId}`)}
      >
        <DataListItemRow>
          <DataListToggle
            onClick={() => toggle(`toggle-${queryId}`)}
            isExpanded={expanded.includes(`toggle-${queryId}`)}
            id={`toggle-${queryId}`}
            aria-controls="query-expand-${queryId}"
          />
          <DataListItemCells
            dataListCells={[
              <DataListCell width={5} key="width 5">
                {promQlexpressionInput}
              </DataListCell>,
            ]}
          />
          <div className="pf-v6-u-mt-sm">
            <DataListAction
              aria-labelledby="query-item-${queryId} query-action-${queryId}"
              id={`action-${queryId}`}
              aria-label="Actions"
            >
              {querySwitch}
              {queryKebab}
            </DataListAction>
          </div>
        </DataListItemRow>
        <DataListContent
          aria-label="First expandable content details"
          id="query-expand-${queryId}"
          isHidden={!expanded.includes(`toggle-${queryId}`)}
        >
          {queryTable}
        </DataListContent>
      </DataListItem>
    </DataList>
  );
};
