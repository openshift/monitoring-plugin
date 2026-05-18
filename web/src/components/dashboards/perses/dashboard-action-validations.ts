import { z } from 'zod';
import { useMemo } from 'react';
import { nameSchema } from '@perses-dev/core';
import { useDashboardList } from './dashboard-api';
import { generateMetadataName } from './dashboard-utils';
import { TFunction } from 'i18next';

export const createDashboardDisplayNameValidationSchema = (t: TFunction) =>
  z.string().min(1, t('Required')).max(75, t('Must be 75 or fewer characters long'));

export const createDashboardDialogValidationSchema = (t: TFunction) =>
  z.object({
    projectName: nameSchema,
    dashboardName: createDashboardDisplayNameValidationSchema(t),
  });

export const importDashboardDialogValidationSchema = () =>
  z.object({
    projectName: nameSchema,
  });

export const renameDashboardDialogValidationSchema = (t: TFunction) =>
  z.object({
    dashboardName: createDashboardDisplayNameValidationSchema(t),
  });

export type CreateDashboardValidationType = z.infer<
  ReturnType<typeof createDashboardDialogValidationSchema>
>;
export type RenameDashboardValidationType = z.infer<
  ReturnType<typeof renameDashboardDialogValidationSchema>
>;
export type ImportDashboardValidationType = z.infer<
  ReturnType<typeof importDashboardDialogValidationSchema>
>;

export interface DashboardValidationSchema {
  schema?: z.ZodSchema;
  isSchemaLoading: boolean;
  hasSchemaError: boolean;
}

// Validate dashboard name and check if it doesn't already exist
export function useDashboardValidationSchema(
  t: TFunction,
  projectName?: string,
): DashboardValidationSchema {
  const {
    data: dashboards,
    isLoading: isDashboardsLoading,
    isError,
  } = useDashboardList({ project: projectName });
  return useMemo((): DashboardValidationSchema => {
    if (isDashboardsLoading) {
      return {
        schema: undefined,
        isSchemaLoading: true,
        hasSchemaError: false,
      };
    }

    if (isError) {
      return {
        hasSchemaError: true,
        isSchemaLoading: false,
        schema: undefined,
      };
    }

    if (!dashboards?.length) {
      return {
        schema: createDashboardDialogValidationSchema(t),
        isSchemaLoading: false,
        hasSchemaError: false,
      };
    }

    const refinedSchema = createDashboardDialogValidationSchema(t).refine(
      (schema) => {
        return !(dashboards ?? []).some((dashboard) => {
          return (
            dashboard.metadata.project.toLowerCase() === schema.projectName.toLowerCase() &&
            dashboard.metadata.name.toLowerCase() ===
              generateMetadataName(schema.dashboardName).toLowerCase()
          );
        });
      },
      (schema) => ({
        message: t(
          `Dashboard name '{{dashboardName}}' already exists in '{{projectName}}' project!`,
          {
            dashboardName: schema.dashboardName,
            projectName: schema.projectName,
          },
        ),
        path: ['dashboardName'],
      }),
    );

    return { schema: refinedSchema, isSchemaLoading: false, hasSchemaError: false };
  }, [dashboards, isDashboardsLoading, isError, t]);
}
