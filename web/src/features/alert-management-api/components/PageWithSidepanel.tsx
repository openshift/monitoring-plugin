import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Title,
} from '@patternfly/react-core';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTestIDs } from '@/shared/constants/data-test';

import '@/features/alert-management-api/assets/page-with-sidepanel.css';

type PageWithSidepanelProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  panel: ReactNode;
  children: ReactNode;
};

export function PageWithSidepanel({
  isOpen,
  onClose,
  title,
  panel,
  children,
}: PageWithSidepanelProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Drawer className="alert-management-api__page-with-sidepanel" isExpanded={isOpen}>
      <DrawerContent
        panelContent={
          <>
            {isOpen && (
              <div
                className="alert-management-api__page-with-sidepanel__backdrop"
                data-testid={DataTestIDs.PageWithSidepanel.Backdrop}
                aria-hidden="true"
                onClick={onClose}
              />
            )}
            <DrawerPanelContent
              data-testid={DataTestIDs.PageWithSidepanel.Panel}
              aria-label={title}
              focusTrap={{ enabled: isOpen }}
              widths={{ default: 'width_100', lg: 'width_50', xl: 'width_33' }}
            >
              {isOpen && (
                <>
                  <DrawerHead>
                    <Title headingLevel="h2" size="xl" tabIndex={-1}>
                      {title}
                    </Title>
                    <DrawerActions>
                      <DrawerCloseButton aria-label={t('Close panel')} onClick={onClose} />
                    </DrawerActions>
                  </DrawerHead>
                  <DrawerPanelBody className="alert-management-api__page-with-sidepanel__body">
                    {panel}
                  </DrawerPanelBody>
                </>
              )}
            </DrawerPanelContent>
          </>
        }
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}
