import * as React from 'react';

export const PageHeading: React.FC<{ helpText: string; title: string }> = ({ helpText, title }) => (
  <div className="co-m-nav-title co-m-nav-title--detail">
    <h1 className="co-m-pane__heading co-m-pane__heading--with-help-text">{title}</h1>
    <p className="help-block co-m-pane__heading-help-text">{helpText}</p>
  </div>
);

export const SectionHeading: React.FC<{ text: string }> = ({ text }) => (
  <h2 className="co-section-heading" data-test-section-heading={text}>
    {text}
  </h2>
);
