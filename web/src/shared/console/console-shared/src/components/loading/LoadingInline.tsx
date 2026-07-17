import type { FCC } from 'react';

import { Loading } from '@/shared/console/console-shared/src/components/loading/Loading';

// Leave to keep compatibility with console looks
export const LoadingInline: FCC = () => <Loading className="co-m-loader--inline" />;
LoadingInline.displayName = 'LoadingInline';
