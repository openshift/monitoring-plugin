import { Button, Flex, FlexItem } from '@patternfly/react-core';
import { CompressIcon, ExpandIcon } from '@patternfly/react-icons';
import { ScatterChart } from '@perses-dev/scatter-chart-plugin';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRefWidth } from '@/features/tracing/components/console/utils/ref-width-hook';
import {
  PersesPanelPluginWrapper,
  usePersesTraceData,
} from '@/features/tracing/components/PersesWrapper';
import { linkToTrace } from '@/features/tracing/utils/links';

export function ScatterPlot() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [isVisible, setVisible] = useState(true);
  const [ref, width] = useRefWidth();
  const { loading, hasTraceData } = usePersesTraceData();

  if (!loading && !hasTraceData) {
    // the trace table already shows a custom empty state
    return null;
  }

  return (
    <div style={{ marginTop: '-0.5rem' }}>
      <Flex>
        <FlexItem align={{ default: 'alignRight' }}>
          <Button variant="link" onClick={() => setVisible(!isVisible)}>
            {isVisible ? (
              <>
                <CompressIcon /> {t('Hide graph')}
              </>
            ) : (
              <>
                <ExpandIcon /> {t('Show graph')}
              </>
            )}
          </Button>
        </FlexItem>
      </Flex>

      {isVisible && (
        <div
          ref={ref}
          style={{
            height: '200px',
            flexShrink: 0,
            border:
              'var(--pf-t--global--border--width--box--default) solid var(--pf-t--global--border--color--default)',
            borderRadius: 'var(--pf-t--global--border--radius--small)',
          }}
        >
          <PersesPanelPluginWrapper
            plugin={ScatterChart}
            contentDimensions={{
              width,
              height: 200,
            }}
            spec={{
              link: linkToTrace(),
            }}
          />
        </div>
      )}
    </div>
  );
}
