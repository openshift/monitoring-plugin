import { useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Flex, FlexItem, Stack, StackItem, Title } from '@patternfly/react-core';
import { TimesCircleIcon } from '@patternfly/react-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { closeTP } from '../redux-actions';
import { State } from '../redux-reducers';
import { HelpPopover } from './HelpPopover';
import Korrel8rPanel from './Korrel8rPanel';
import './popover.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export default function Popover({ closeOverlay }: { closeOverlay: () => void }) {
  const dispatch = useDispatch();
  const [activePerspective] = useActivePerspective();
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');

  const isOpen = useSelector((state: State) => state.plugins?.tp?.get('isOpen'));

  const close = useCallback(() => {
    dispatch(closeTP());
    closeOverlay();
  }, [dispatch, closeOverlay]);

  useEffect(() => {
    if (activePerspective !== 'admin' && isOpen) {
      close();
    }
  }, [activePerspective, isOpen, close]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <Stack className="tp-plugin__popover">
          <Flex className="tp-plugin__popover-title-bar" gap={{ default: 'gapNone' }}>
            <FlexItem grow={{ default: 'grow' }}>
              <Title headingLevel="h1">
                {t('Troubleshooting')}
                <HelpPopover
                  header={t(
                    'Quickly diagnose and resolve issues by exploring correlated observability signals for resources.',
                  )}
                ></HelpPopover>
              </Title>
            </FlexItem>
            <FlexItem>
              <Button variant="plain" aria-label="Close" onClick={close}>
                <TimesCircleIcon className="tp-plugin__popover-close" />
              </Button>
            </FlexItem>
          </Flex>
          <StackItem className="tp-plugin__popover-content" isFilled={true}>
            <Korrel8rPanel />
          </StackItem>
        </Stack>
      </QueryClientProvider>
    </>
  );
}
