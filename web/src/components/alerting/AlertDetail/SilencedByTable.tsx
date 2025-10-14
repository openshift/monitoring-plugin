import type { FC, MouseEvent } from 'react';
import { useState, useMemo } from 'react';
import { ResourceIcon, Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';
import {
  getEditSilenceAlertUrl,
  getSilenceAlertUrl,
  usePerspective,
} from '../../hooks/usePerspective';
import {
  DataViewTable,
  DataViewTr,
  DataViewTh,
} from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import { Flex, FlexItem, Stack, StackItem } from '@patternfly/react-core';
import { ActionsColumn, IAction } from '@patternfly/react-table';
import { ExpireSilenceModal, SilenceMatchersList, SilenceState } from '../SilencesUtils';
import { useBoolean } from '../../hooks/useBoolean';
import { SilenceResource } from '../../utils';
import { Link } from 'react-router-dom-v5-compat';
import { SeverityCounts, StateTimestamp } from '../AlertUtils';
import { t_global_spacer_xs } from '@patternfly/react-tokens';

export const SilencedByList: FC<{ silences: Silence[] }> = ({ silences }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);
  const [silence, setSilence] = useState<Silence | null>(null);

  const editSilence = (event: MouseEvent, rowIndex: number) => {
    navigate(getEditSilenceAlertUrl(perspective, silences.at(rowIndex)?.id));
  };

  const rowActions = (silence: Silence): IAction[] => {
    if (silence.status.state === SilenceStates.Expired) {
      return [
        {
          title: t('Recreate silence'),
          onClick: editSilence,
        },
      ];
    }
    return [
      {
        title: t('Edit silence'),
        onClick: editSilence,
      },
      {
        title: t('Expire silence'),
        onClick: (event: MouseEvent, rowIndex: number) => {
          setSilence(silences.at(rowIndex));
          setModalOpen();
        },
      },
    ];
  };

  const rows: DataViewTr[] = silences.map((silence) => [
    {
      cell: (
        <>
          <Flex
            spaceItems={{ default: 'spaceItemsNone' }}
            flexWrap={{ default: 'nowrap' }}
            style={{ paddingBottom: t_global_spacer_xs.var }}
          >
            <FlexItem>
              <ResourceIcon kind={SilenceResource.kind} />
            </FlexItem>
            <FlexItem>
              <Link
                data-test-id="silence-resource-link"
                title={silence.id}
                to={getSilenceAlertUrl(perspective, silence.id)}
              >
                {silence.name}
              </Link>
            </FlexItem>
          </Flex>
          <SilenceMatchersList silence={silence} />
        </>
      ),
      props: { width: 40 },
    },
    {
      cell: <SeverityCounts alerts={silence.firingAlerts} />,
      props: { width: 15 },
    },
    {
      cell: (
        <Stack>
          <StackItem>
            <SilenceState silence={silence} />
          </StackItem>
          <StackItem>
            {silence.status.state === SilenceStates.Pending && (
              <StateTimestamp text={t('Starts')} timestamp={silence.startsAt} />
            )}
            {silence.status.state === SilenceStates.Active && (
              <StateTimestamp text={t('Ends')} timestamp={silence.endsAt} />
            )}
            {silence.status.state === SilenceStates.Expired && (
              <StateTimestamp text={t('Expired')} timestamp={silence.endsAt} />
            )}
          </StackItem>
        </Stack>
      ),
      props: { width: 20 },
    },
    {
      cell: silence.createdBy || '-',
      props: { width: 15 },
    },
    {
      cell: <ActionsColumn items={rowActions(silence)} />,
      props: { isActionCell: true },
    },
  ]);

  const columns = useMemo<Array<DataViewTh>>(
    () => [
      {
        id: 'name',
        cell: t('Name'),
        props: { width: 40 },
      },
      {
        id: 'firingAlerts',
        cell: t('Firing alerts'),
        props: { width: 15 },
      },
      {
        id: 'state',
        cell: t('State'),
        props: { width: 20 },
      },
      {
        id: 'createdBy',
        cell: t('Creator'),
        props: { width: 15 },
      },
    ],
    [t],
  );

  return (
    <>
      <DataViewTable
        aria-label="Silenced By Table"
        ouiaId="SilencedByTable"
        columns={columns}
        rows={rows}
      />
      <ExpireSilenceModal isOpen={isModalOpen} setClosed={setModalClosed} silenceID={silence?.id} />
    </>
  );
};
