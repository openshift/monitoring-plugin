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
  const [expanded, setExpanded] = useState(['ex-toggle1', 'ex-toggle3']);
  const toggle = (id) => {
    const index = expanded.indexOf(id);
    const newExpanded =
      index >= 0
        ? [...expanded.slice(0, index), ...expanded.slice(index + 1, expanded.length)]
        : [...expanded, id];
    setExpanded(newExpanded);
  };

  return (
    <Fragment>
      <DataList aria-label="Expandable data list example">
        <DataListItem aria-labelledby="ex-item1" isExpanded={expanded.includes('ex-toggle1')}>
          <DataListItemRow>
            <DataListToggle
              onClick={() => toggle('ex-toggle1')}
              isExpanded={expanded.includes('ex-toggle1')}
              id={`toggle-${queryId}`}
              aria-controls="ex-expand1"
            />
            {/* <DataListContent aria-label="First expandable content details" id="ex-expand1">
              {promQlexpressionInput}
            </DataListContent> */}

            <DataListItemCells
              dataListCells={[
                <DataListCell width={5} key="width 5">
                  {promQlexpressionInput}
                </DataListCell>,
              ]}
            />

            <DataListAction
              aria-labelledby="ex-item1 ex-action1"
              id={`action-${queryId}`}
              aria-label="Actions"
            >
              {querySwitch}
              {queryKebab}
            </DataListAction>
          </DataListItemRow>
          <DataListContent
            aria-label="First expandable content details"
            id="ex-expand1"
            isHidden={!expanded.includes('ex-toggle1')}
          >
            {queryTable}
          </DataListContent>
        </DataListItem>
      </DataList>
    </Fragment>
  );
};
