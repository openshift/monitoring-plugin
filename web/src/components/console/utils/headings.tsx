import * as React from 'react';

export const SectionHeading: React.FC<{ text: string }> = ({ text }) => (
  <h2 className="co-section-heading" data-test-section-heading={text}>
    {text}
  </h2>
);
