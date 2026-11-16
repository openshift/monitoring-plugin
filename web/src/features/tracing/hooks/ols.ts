import { Extension } from '@openshift-console/dynamic-plugin-sdk/lib/types';

export type Attachment = {
  attachmentType: AttachmentTypes;
  isEditable?: boolean;
  kind: string;
  name: string;
  namespace: string;
  originalValue?: string;
  ownerName?: string;
  value: string;
};

export enum AttachmentTypes {
  YAML = 'YAML',
}

export type OpenOLSHandlerProps = {
  contextId: string;
  provider: () => (prompt?: string, attachments?: Attachment[]) => void;
};

type OpenOLSHandlerExtension = Extension<'console.action/provider', OpenOLSHandlerProps>;

// Type guard for OpenShift Lightspeed open handler extensions
export const isOpenOLSHandlerExtension = (e: Extension): e is OpenOLSHandlerExtension =>
  e.type === 'console.action/provider' && e.properties?.contextId === 'ols-open-handler';
