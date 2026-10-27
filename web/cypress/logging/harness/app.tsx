import '@patternfly/react-core/dist/styles/base.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router';
import LogsAlertMetrics from '@/features/logging/components/alerts/LogsAlertsMetrics';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translations from '../../../locales/en/plugin__monitoring-plugin.json';
import './index.css';
import LogsDetailPage from '@/features/logging/pages/LogsDetailPage';
import LogsDevPage from '@/features/logging/pages/LogsDevPage';
import LogsPage from '@/features/logging/pages/LogsPage';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadMain,
  MenuToggle,
  MenuToggleElement,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSection,
  PageSidebar,
} from '@patternfly/react-core';
import { TestIds } from '@/features/logging/utils/test-ids';
import { Ref, useState } from 'react';

const DevConsole = () => {
  const { ns: namespace } = useParams<{ ns: string }>();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const onToggle = () => {
    setIsOpen(!isOpen);
  };

  const onSelectNamespace = (selectedNamespace: string) => () => {
    navigate(`/dev-monitoring/ns/${selectedNamespace}/logs`);
    setIsOpen(false);
  };

  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onSelect={() => setIsOpen(false)}
        onOpenChange={(isOpenVal: boolean) => setIsOpen(isOpenVal)}
        toggle={(toggleRef: Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            onClick={onToggle}
            isExpanded={isOpen}
            id="toggle-basic"
            data-test={TestIds.NamespaceToggle}
          >
            {namespace}
          </MenuToggle>
        )}
      >
        <DropdownList data-test={TestIds.NamespaceDropdown}>
          <DropdownItem onClick={onSelectNamespace('default')} key="default" component="button">
            default
          </DropdownItem>
          <DropdownItem
            onClick={onSelectNamespace('my-namespace')}
            key="my-namespace"
            component="button"
          >
            my-namespace
          </DropdownItem>
          <DropdownItem
            onClick={onSelectNamespace('my-namespace-two')}
            key="my-namespace-two"
            component="button"
          >
            my-namespace-two
          </DropdownItem>
          <DropdownItem
            onClick={onSelectNamespace('openshift-cluster-version')}
            key="action"
            component="button"
          >
            openshift-cluster-version
          </DropdownItem>
        </DropdownList>
      </Dropdown>
      <LogsDevPage />
    </>
  );
};

const EndToEndTestsApp = () => {
  return (
    <BrowserRouter>
      <Page
        className="lv-plugin__standalone__page"
        masthead={
          <Masthead>
            <MastheadMain />
          </Masthead>
        }
        sidebar={
          <PageSidebar className="lv-plugin__standalone__side-menu">
            <Nav aria-label="Global">
              <NavList>
                <NavItem>
                  <Link to="/k8s/ns/default/pods/test-pod-name">Pods Logs</Link>
                </NavItem>
                <NavItem>
                  <Link to="/dev-monitoring/ns/my-namespace/logs">Dev Logs</Link>
                </NavItem>
                <NavItem>
                  <Link to="/monitoring/logs">Logs</Link>
                </NavItem>
                <NavItem>
                  <Link to="/monitoring/alerts/test-alert">Alerts</Link>
                </NavItem>
              </NavList>
            </Nav>
          </PageSidebar>
        }
      >
        <PageSection>
          <Routes>
            <Route path="/monitoring/logs" element={<LogsPage />} />
            <Route path="/dev-monitoring/ns/:ns/logs" element={<DevConsole />} />
            <Route path="/k8s/ns/:ns/pods/:name" element={<LogsDetailPage />} />
            <Route
              path="/monitoring/alerts/:alertname"
              element={
                <LogsAlertMetrics
                  rule={{
                    labels: { tenantId: 'application' },
                    query: `sum by(job)(rate({ job=~".+" }[5m])) > 0`,
                  }}
                />
              }
            />
          </Routes>
        </PageSection>
      </Page>
    </BrowserRouter>
  );
};

i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    keySeparator: false,
    nsSeparator: '~',
    defaultNS: 'plugin__monitoring-console-plugin',
    resources: { en: { 'plugin__monitoring-console-plugin': translations } },
  })
  .then(() => {
    const root = createRoot(document.getElementById('app'));
    root.render(<EndToEndTestsApp />);
  });
