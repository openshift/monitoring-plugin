import type { FCC } from 'react';
import { Loading } from './Loading';

// Leave to keep compatibility with console looks
export const LoadingInline: FCC = () => <Loading className="co-m-loader--inline" />;
LoadingInline.displayName = 'LoadingInline';
