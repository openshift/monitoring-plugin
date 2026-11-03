import { Form, FormGroup, Popover, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { TempoResource, useTempoResources } from '../hooks/useTempoResources';
import { TempoInstance } from '../hooks/useTempoInstance';
import { ResourceIcon } from '@openshift-console/dynamic-plugin-sdk';
import { ControlledTypeaheadSelect } from './ControlledSelects';
import { TypeaheadSelectOption } from './TypeaheadSelect';
import { HelpIcon } from '@patternfly/react-icons';

interface TempoInstanceDropdownProps {
  tempo: TempoInstance | undefined;
  setTempo: (tempo?: TempoInstance) => void;
}

interface TempoResourceOption extends TypeaheadSelectOption {
  tempo: TempoResource;
  value: string;
}

export const TempoInstanceDropdown = ({ tempo, setTempo }: TempoInstanceDropdownProps) => {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { isLoading, data: tempoResources } = useTempoResources();

  const options: TempoResourceOption[] = (tempoResources ?? [])
    .map((tempo) => ({
      value: `${tempo.namespace}__${tempo.name}`,
      content: `${tempo.namespace} / ${tempo.name}`,
      icon: <ResourceIcon groupVersionKind={{ kind: tempo.kind, version: '' }} />,
      tempo,
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  let selected: TempoResourceOption | undefined = undefined;
  if (tempo) {
    if (isLoading) {
      // Preselect the dropdown option without waiting until the list of TempoResources is loaded to prevent flickering.
      // To accomplish this, we'll create a slightly inaccurate TempoResourceSelectOption,
      // because the kind and the list of tenants is not known before the list of TempoResources is loaded.
      selected = {
        value: `${tempo.namespace}__${tempo.name}`,
        content: `${tempo.namespace} / ${tempo.name}`,
        icon: <ResourceIcon groupVersionKind={{ kind: 'TempoStack', version: '' }} />,
        tempo: {
          kind: 'TempoStack',
          namespace: tempo.namespace,
          name: tempo.name,
          tenants: tempo.tenant ? [tempo.tenant] : undefined,
        },
      };
      options.push(selected);
    } else {
      selected = options.find(
        (o) => o.tempo.namespace == tempo.namespace && o.tempo.name == tempo.name,
      );
    }
  }

  const onSelect = (value?: string) => {
    if (!value) {
      setTempo(undefined);
      return;
    }

    const option = options.find((o) => o.value === value);
    if (option && option.value !== selected?.value) {
      setTempo({
        namespace: option.tempo.namespace,
        name: option.tempo.name,
        tenant: option.tempo.tenants?.[0], // select first tenant by default, or undefined if no tenants
      });
    }
  };

  // Preselect the first instance if there is only one instance available.
  if (!selected && options.length === 1) {
    onSelect(options[0].value);
  }

  return (
    <ToolbarGroup variant="filter-group">
      <ToolbarItem>
        <Form>
          <FormGroup
            fieldId="tempoinstance-select"
            label={t('Tempo instance')}
            labelHelp={
              <Popover
                headerContent={<div>{t('Select a Tempo instance')}</div>}
                bodyContent={
                  <div>
                    {t(
                      'TempoStack and TempoMonolithic instances with multi-tenancy are supported. Instances without multi-tenancy are not supported.',
                    )}
                  </div>
                }
              >
                <HelpIcon />
              </Popover>
            }
          >
            <ControlledTypeaheadSelect
              id="tempoinstance-select"
              toggleWidth="22em"
              placeholder={t('Select a Tempo instance')}
              allowClear={false}
              loading={isLoading}
              options={options}
              value={selected?.value}
              setValue={onSelect}
              style={{ maxHeight: '50vh', overflow: 'auto' }}
            />
          </FormGroup>
        </Form>
      </ToolbarItem>
      {selected?.tempo.tenants && selected.tempo.tenants.length > 0 && tempo && (
        <ToolbarItem>
          <Form>
            <FormGroup fieldId="tenant-select" label={t('Tenant')}>
              <ControlledTypeaheadSelect
                id="tenant-select"
                toggleWidth="15em"
                placeholder={t('Select a tenant')}
                allowClear={false}
                options={selected.tempo.tenants.map((t) => ({ value: t, content: t }))}
                value={tempo.tenant}
                setValue={(tenant) => setTempo({ ...tempo, tenant })}
                style={{ maxHeight: '50vh', overflow: 'auto' }}
              />
            </FormGroup>
          </Form>
        </ToolbarItem>
      )}
    </ToolbarGroup>
  );
};
