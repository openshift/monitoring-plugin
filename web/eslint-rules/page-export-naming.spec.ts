import { type Linter, RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { pageExportNaming } from './page-export-naming';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    parser: tsParser as unknown as Linter.LanguageOptions['parser'],
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const pageFile = '/src/features/alerts/pages/AlertsPage.tsx';
const otherPageFile = '/src/features/incidents/pages/IncidentsPage.tsx';
const nonPageFile = '/src/features/alerts/components/AlertsTable.tsx';
const nestedPageFile = '/src/features/alerts/pages/alerts-page/AlertsPage.tsx';
const specFile = '/src/features/alerts/pages/AlertsPage.spec.tsx';
const nonTsxPageFile = '/src/features/alerts/pages/alerts-page.ts';

ruleTester.run('page-export-naming', pageExportNaming, {
  valid: [
    {
      code: 'export const MpCmoAlertsPage = () => <div />;',
      filename: pageFile,
    },
    {
      code: 'export function AlertManagementAlertsPage() { return <div />; }',
      filename: pageFile,
    },
    {
      code: 'const AlertsPage = () => <div />; export default AlertsPage;',
      filename: pageFile,
    },
    {
      code: 'export default function AlertsPage() { return <div />; }',
      filename: pageFile,
    },
    {
      code: 'export type AlertsPageProps = { title: string };',
      filename: pageFile,
    },
    {
      code: 'type AlertsPageProps = { title: string }; export { type AlertsPageProps };',
      filename: pageFile,
    },
    {
      code: 'const AlertsPage = () => <div />; type AlertsPageProps = { a: number }; export { AlertsPage, type AlertsPageProps };',
      filename: pageFile,
    },
    {
      code: "export * as AlertsPage from './AlertsPage';",
      filename: pageFile,
    },
    {
      code: 'export { default as AlertsPage } from "./AlertsPage";',
      filename: pageFile,
    },
    // Non-page files are not restricted
    {
      code: 'export const AlertsTable = () => <div />; export const useAlerts = () => {};',
      filename: nonPageFile,
    },
    {
      code: 'export const getReferenceForModel = (model) => model.name;',
      filename: nonTsxPageFile,
    },
    // Spec files are not restricted
    {
      code: 'export const helper = () => {};',
      filename: specFile,
    },
    {
      code: 'export const MpCmoIncidentsPage = () => <div />;',
      filename: otherPageFile,
    },
    {
      code: 'export const MpCmoAlertsPage = () => <div />;',
      filename: nestedPageFile,
    },
    // Anonymous default exports cannot be checked by name
    {
      code: 'export default () => <div />;',
      filename: pageFile,
    },
  ],
  invalid: [
    {
      code: 'export const PrometheusTemplate = ({ text }) => <span>{text}</span>;',
      filename: pageFile,
      errors: [
        {
          messageId: 'invalidPageExport',
          data: { file: 'AlertsPage.tsx', name: 'PrometheusTemplate' },
        },
      ],
    },
    {
      code: 'export function getReferenceForModel(model) { return model.name; }',
      filename: nestedPageFile,
      errors: [
        {
          messageId: 'invalidPageExport',
          data: { file: 'AlertsPage.tsx', name: 'getReferenceForModel' },
        },
      ],
    },
    {
      code: 'export const helper = () => {};',
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'helper' } },
      ],
    },
    {
      code: 'const AlertsTable = () => <div />; export { AlertsTable };',
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'AlertsTable' } },
      ],
    },
    {
      code: 'export class AlertsTable {}',
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'AlertsTable' } },
      ],
    },
    {
      code: 'const LogsPageWrapper = () => <div />; export default LogsPageWrapper;',
      filename: pageFile,
      errors: [
        {
          messageId: 'invalidPageExport',
          data: { file: 'AlertsPage.tsx', name: 'LogsPageWrapper' },
        },
      ],
    },
    {
      code: 'export default function PrometheusRouterRedirect() { return <div />; }',
      filename: pageFile,
      errors: [
        {
          messageId: 'invalidPageExport',
          data: { file: 'AlertsPage.tsx', name: 'PrometheusRouterRedirect' },
        },
      ],
    },
    {
      code: 'export const AlertsPage = () => <div />; export const AlertsTable = () => <div />;',
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'AlertsTable' } },
      ],
    },
    {
      code: "export * from './helpers';",
      filename: pageFile,
      errors: [{ messageId: 'noStarReexport', data: { file: 'AlertsPage.tsx' } }],
    },
    {
      code: 'const utils = { helper: () => {} }; export const { helper } = utils;',
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'helper' } },
      ],
    },
    {
      code: 'const arr = [() => {}]; export const [first] = arr;',
      filename: pageFile,
      errors: [{ messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'first' } }],
    },
    {
      code: "export * as helpers from './helpers';",
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'helpers' } },
      ],
    },
    {
      code: 'const AlertsTable = () => <div />; export { AlertsTable, type AlertsTableProps };',
      filename: pageFile,
      errors: [
        { messageId: 'invalidPageExport', data: { file: 'AlertsPage.tsx', name: 'AlertsTable' } },
      ],
    },
  ],
});
