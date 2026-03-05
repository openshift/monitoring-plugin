import { zodResolver } from '@hookform/resolvers/zod';
import { CodeEditor } from '@patternfly/react-code-editor';
import {
  AlertVariant,
  Button,
  FileUpload,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import yaml from 'js-yaml';
import React, { ChangeEvent, useEffect, useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  PermissionStateWrapper,
  ProjectSelectFormGroup,
  useDashboardNavigation,
  useDashboardProjects,
  useProjectCreation,
} from './dashboard-dialog-helpers';

import { DashboardResource } from '@perses-dev/core';
import { usePatternFlyTheme } from '../../hooks/usePatternflyTheme';
import {
  importDashboardDialogValidationSchema,
  ImportDashboardValidationType,
} from './dashboard-action-validations';
import { useCreateDashboardMutation } from './dashboard-api';
import { useMigrateDashboard } from './migrate-api';
import { useToast } from './ToastProvider';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['application/json', 'text/yaml', 'application/x-yaml', 'text/x-yaml'];

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return typeof error === 'string' ? error : undefined;
};

// Sanitize dashboard name to prevent XSS when displaying in alerts/UI
const sanitizeDashboardName = (name: string | undefined): string => {
  if (!name) return 'Untitled';
  // Remove potentially dangerous characters and limit length
  return name.replace(/[<>"'&]/g, '').substring(0, 100);
};

type DashboardType = 'grafana' | 'perses' | undefined;

interface ParsedDashboard {
  kind: DashboardType;
  data: Record<string, unknown> | DashboardResource;
}

interface DashboardImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardImportDialog: React.FunctionComponent<DashboardImportDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const {
    editableProjects,
    permissionsLoading,
    permissionsError,
    persesProjects,
    defaultProject,
    projectOptions,
  } = useDashboardProjects();

  const { ensureProjectExists, isCreatingProject } = useProjectCreation();
  const { navigateToDashboard } = useDashboardNavigation();
  const { theme } = usePatternFlyTheme();

  const form = useForm<ImportDashboardValidationType>({
    resolver: zodResolver(importDashboardDialogValidationSchema()),
    mode: 'onBlur',
    defaultValues: {
      projectName: defaultProject,
    },
  });

  const [dashboardInput, setDashboardInput] = useState<string>('');
  const [parsedDashboard, setParsedDashboard] = useState<ParsedDashboard | undefined>();
  const [parseError, setParseError] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const createDashboardMutation = useCreateDashboardMutation();
  const migrateMutation = useMigrateDashboard();

  useEffect(() => {
    if (isOpen && editableProjects?.length > 0 && defaultProject) {
      form.reset({
        projectName: defaultProject,
      });
    }
  }, [isOpen, defaultProject, editableProjects?.length, form]);

  const getDashboardType = (dashboard: Record<string, unknown>): DashboardType => {
    if ('kind' in dashboard && dashboard.kind === 'Dashboard') {
      return 'perses';
    }
    if ('panels' in dashboard || 'templating' in dashboard || 'annotations' in dashboard) {
      return 'grafana';
    }
    return undefined;
  };

  const detectInputFormat = (input: string): 'json' | 'yaml' => {
    const trimmed = input.trim();
    if (trimmed.startsWith('{')) {
      return 'json';
    }

    return 'yaml';
  };

  const parseDashboardInput = (input: string): void => {
    if (!input.trim()) {
      setParsedDashboard(undefined);
      setParseError('');
      return;
    }

    const detectedFormat = detectInputFormat(input);

    try {
      let parsed: Record<string, unknown>;

      if (detectedFormat === 'json') {
        parsed = JSON.parse(input);
      } else {
        const loaded = yaml.load(input);
        if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
          throw new Error('Dashboard must be a valid object');
        }
        parsed = loaded as Record<string, unknown>;
      }

      const type = getDashboardType(parsed);
      if (type) {
        setParsedDashboard({ kind: type, data: parsed });
        setParseError('');
      } else {
        setParsedDashboard(undefined);
        setParseError(
          t(
            'Unable to detect dashboard format. Please provide a valid Perses or Grafana dashboard.',
          ),
        );
      }
    } catch (error) {
      setParsedDashboard(undefined);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setParseError(
        t('Invalid {{format}}: {{error}}', {
          format: detectedFormat.toUpperCase(),
          error: errorMessage,
        }),
      );
    }
  };

  const handleDashboardInputChange = (value: string) => {
    setDashboardInput(value);
    parseDashboardInput(value);
  };

  const handleFileUpload = async (
    _event: ChangeEvent<HTMLInputElement>,
    file: File,
  ): Promise<void> => {
    if (file) {
      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        setParseError(
          t('Invalid file type. Please upload a JSON or YAML file (.json, .yaml, .yml)'),
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setParseError(t('File size exceeds maximum allowed size of 5MB'));
        return;
      }
      setIsUploadingFile(true);
      try {
        setFilename(file.name);
        const text = await file.text();
        setDashboardInput(text);
        parseDashboardInput(text);
      } finally {
        setIsUploadingFile(false);
      }
    }
  };

  const handleClearFile = (): void => {
    setFilename('');
    setDashboardInput('');
    setParsedDashboard(undefined);
    setParseError('');
  };

  const isImporting =
    createDashboardMutation.isPending || isCreatingProject || migrateMutation.isPending;

  const importDashboard = async (dashboard: DashboardResource, projectName: string) => {
    dashboard.metadata.project = projectName;

    const createdDashboard = await createDashboardMutation.mutateAsync(dashboard);

    const displayName = sanitizeDashboardName(
      createdDashboard.spec?.display?.name || createdDashboard.metadata.name,
    );
    addAlert(
      t('Dashboard "{{name}}" imported successfully', { name: displayName }),
      AlertVariant.success,
    );

    handleClose();
    navigateToDashboard(createdDashboard, true);
  };

  const processForm: SubmitHandler<ImportDashboardValidationType> = async (data) => {
    if (isImporting) {
      return;
    }

    if (!parsedDashboard) {
      addAlert(t('A valid dashboard is required'), AlertVariant.danger);
      return;
    }

    const currentProject = data.projectName;
    const currentParsedDashboard = parsedDashboard;

    try {
      await ensureProjectExists(currentProject, persesProjects || []);
    } catch {
      return;
    }

    try {
      if (currentParsedDashboard.kind === 'grafana') {
        // Migrate Grafana dashboard first, then import
        migrateMutation.mutate(
          {
            grafanaDashboard: currentParsedDashboard.data as Record<string, unknown>,
            useDefaultDatasource: true,
          },
          {
            onSuccess: async (migratedDashboard) => {
              try {
                await importDashboard(migratedDashboard, currentProject);
              } catch (error) {
                const errorMessage =
                  getErrorMessage(error) || t('Failed to import dashboard. Please try again.');
                addAlert(
                  t('Error importing dashboard: {{error}}', { error: errorMessage }),
                  AlertVariant.danger,
                );
              }
            },
            onError: (error) => {
              const errorMessage =
                getErrorMessage(error) || t('Migration failed. Please try again.');
              addAlert(
                t('Error migrating dashboard: {{error}}', { error: errorMessage }),
                AlertVariant.danger,
              );
            },
          },
        );
      } else {
        // Direct import for Perses dashboard
        await importDashboard(currentParsedDashboard.data as DashboardResource, currentProject);
      }
    } catch (error) {
      const errorMessage =
        getErrorMessage(error) || t('Failed to import dashboard. Please try again.');
      addAlert(
        t('Error importing dashboard: {{error}}', { error: errorMessage }),
        AlertVariant.danger,
      );
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setDashboardInput('');
    setParsedDashboard(undefined);
    setParseError('');
    setFilename('');
    form.reset();
  };

  const projectNameValue = form.watch('projectName');
  const canImport = parsedDashboard && projectNameValue && !isImporting && !parseError;

  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={handleClose}
      onEscapePress={handleClose}
      aria-labelledby="import-dashboard-modal"
    >
      <ModalHeader title={t('Import Dashboard')} labelId="import-dashboard-modal" />
      <ModalBody>
        <PermissionStateWrapper
          permissionsLoading={permissionsLoading}
          permissionsError={permissionsError}
        >
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(processForm)}>
              <Stack hasGutter>
                <StackItem>
                  <FormGroup
                    label={t('1. Provide a dashboard (JSON or YAML)')}
                    fieldId="import-dashboard-input"
                  >
                    <HelperText style={{ marginBottom: '8px' }}>
                      <HelperTextItem>
                        {t(
                          'Upload a dashboard file or paste the dashboard definition directly in the editor below.',
                        )}
                      </HelperTextItem>
                    </HelperText>
                    <Stack hasGutter>
                      <StackItem>
                        <FileUpload
                          id="import-dashboard-file"
                          type="text"
                          value={dashboardInput}
                          filename={filename}
                          filenamePlaceholder={t('Drag and drop a file or upload one')}
                          browseButtonText={t('Upload')}
                          clearButtonText={t('Clear')}
                          onFileInputChange={handleFileUpload}
                          onClearClick={handleClearFile}
                          hideDefaultPreview
                          isLoading={isUploadingFile}
                        />
                      </StackItem>
                      <StackItem>
                        <CodeEditor
                          id="import-dashboard-code-editor"
                          code={dashboardInput}
                          onChange={handleDashboardInputChange}
                          height="300px"
                          isLineNumbersVisible
                          isDarkTheme={theme === 'dark'}
                        />
                      </StackItem>
                    </Stack>
                    {parseError && (
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                            {parseError}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    )}
                    {parsedDashboard && (
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem variant="success">
                            {parsedDashboard.kind === 'grafana'
                              ? t(
                                  'Grafana dashboard detected. It will be automatically migrated to Perses format. Note: migration may be partial as not all Grafana features are supported.',
                                )
                              : t('Perses dashboard detected.')}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    )}
                  </FormGroup>
                </StackItem>

                {parsedDashboard && (
                  <StackItem>
                    <ProjectSelectFormGroup
                      control={form.control}
                      projectOptions={projectOptions}
                      defaultValue={projectNameValue || defaultProject}
                      label={t('2. Select project')}
                      maxHeight="200px"
                    />
                  </StackItem>
                )}
              </Stack>
            </form>
          </FormProvider>
        </PermissionStateWrapper>
      </ModalBody>
      <ModalFooter>
        <Button
          key="import"
          variant="primary"
          onClick={form.handleSubmit(processForm)}
          isDisabled={!canImport}
          isLoading={isImporting}
        >
          {isImporting ? t('Importing...') : t('Import')}
        </Button>
        <Button key="cancel" variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
