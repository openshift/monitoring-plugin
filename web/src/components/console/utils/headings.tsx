import * as React from 'react';
import classNames from 'classnames';

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  text,
  children,
  style,
  required,
  id,
}) => (
  <h2 className="co-section-heading" style={style} data-test-section-heading={text} id={id}>
    <span
      className={classNames({
        'co-required': required,
      })}
    >
      {text}
    </span>
    {children}
  </h2>
);

export type SectionHeadingProps = {
  children?: any;
  style?: any;
  text: string;
  required?: boolean;
  id?: string;
};
