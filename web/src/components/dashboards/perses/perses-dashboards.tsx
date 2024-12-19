import * as _ from 'lodash-es';
import * as React from 'react';
import { Perspective } from 'src/actions/observe';

export const PersesBoard: React.FC<BoardProps> = ({ board, perspective }) => (
  <>
    <div>{board}</div>
    <div>{perspective}</div>
  </>
);

type BoardProps = {
  board: string;
  perspective: Perspective;
};
