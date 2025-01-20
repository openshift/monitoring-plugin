import * as React from 'react';
import { Perspective } from 'src/actions/observe';

export const PersesBoard: React.FC<BoardProps> = ({ dashboardName, perspective }) => (
  <>
    <div>{dashboardName}</div>
    <div>{perspective}</div>
  </>
);

type BoardProps = {
  dashboardName: string;
  perspective: Perspective;
};
