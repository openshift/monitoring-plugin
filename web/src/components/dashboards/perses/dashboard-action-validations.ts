import { z } from 'zod';
import { useMemo } from 'react';
import { nameSchema } from '@perses-dev/core';
import { useDashboardList } from './dashboard-api';
import { generateMetadataName } from './dashboard-utils';

export const createDashboardDisplayNameValidationSchema = (t: (key: string) => string) =>
  z.string().min(1, t('Required')).max(75, t('Must be 75 or fewer characters long'));

export const createDashboardDialogValidationSchema = (t: (key: string) => string) =>
  z.object({
    projectName: nameSchema,
    dashboardName: createDashboardDisplayNameValidationSchema(t),
  });

export const renameDashboardDialogValidationSchema = (t: (key: string) => string) =>
  z.object({
    dashboardName: createDashboardDisplayNameValidationSchema(t),
  });

export type CreateDashboardValidationType = z.infer<
  ReturnType<typeof createDashboardDialogValidationSchema>
>;
export type RenameDashboardValidationType = z.infer<
  ReturnType<typeof renameDashboardDialogValidationSchema>
>;

export interface DashboardValidationSchema {
  schema?: z.ZodSchema;
  isSchemaLoading: boolean;
  hasSchemaError: boolean;
}

// Validate dashboard name and check if it doesn't already exist
export function useDashboardValidationSchema(
  projectName?: string,
  t?: (key: string, options?: any) => string,
): DashboardValidationSchema {
  const {
    data: dashboards,
    isLoading: isDashboardsLoading,
    isError,
  } = useDashboardList({ project: projectName });
  return useMemo((): DashboardValidationSchema => {
    if (isDashboardsLoading)
      return {
        schema: undefined,
        isSchemaLoading: true,
        hasSchemaError: false,
      };

    if (isError) {
      return {
        hasSchemaError: true,
        isSchemaLoading: false,
        schema: undefined,
      };
    }

    if (!dashboards?.length)
      return {
        schema: createDashboardDialogValidationSchema(t),
        isSchemaLoading: false,
        hasSchemaError: false,
      };

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
        // eslint-disable-next-line max-len
        message: t
          ? t(`Dashboard name '{{dashboardName}}' already exists in '{{projectName}}' project!`, {
              dashboardName: schema.dashboardName,
              projectName: schema.projectName,
            })
          : // eslint-disable-next-line max-len
            `Dashboard name '${schema.dashboardName}' already exists in '${schema.projectName}' project!`,
        path: ['dashboardName'],
      }),
    );

    return { schema: refinedSchema, isSchemaLoading: false, hasSchemaError: false };
  }, [dashboards, isDashboardsLoading, isError, t]);
}
