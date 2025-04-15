import React from 'react';
import { useState } from 'react';
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
import { t_global_spacer_md } from '@patternfly/react-tokens';

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
    <DataList aria-label={`query-row-${queryId}`}>
      <DataListItem
        aria-labelledby={`query-item-${queryId}`}
        isExpanded={expanded.includes(`toggle-${queryId}`)}
      >
        <DataListItemRow>
          <DataListToggle
            onClick={() => toggle(`toggle-${queryId}`)}
            isExpanded={expanded.includes(`toggle-${queryId}`)}
            buttonProps={{ isInline: true }}
            id={`toggle-${queryId}`}
            aria-controls={`query-expand-${queryId}`}
          />
          <DataListItemCells
            dataListCells={[
              <DataListCell
                width={5}
                key="width 5"
                style={{ paddingTop: t_global_spacer_md.var, paddingBottom: 0 }}
              >
                {/* <DataListCell width={5} key="width 5" className="pf-v6-u-pt-md"> */}
                {promQlexpressionInput}
              </DataListCell>,
            ]}
            style={{ paddingBottom: 0 }}
          />
          <DataListAction
            aria-labelledby={`query-item-${queryId} query-action-${queryId}`}
            id={`action-${queryId}`}
            aria-label="Actions"
          >
            {querySwitch}
            {queryKebab}
          </DataListAction>
        </DataListItemRow>
        <DataListContent
          aria-label="Expandable content details"
          id={`query-expand-${queryId}`}
          isHidden={!expanded.includes(`toggle-${queryId}`)}
        >
          {queryTable}
        </DataListContent>
      </DataListItem>
    </DataList>
  );
};
