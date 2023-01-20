const getReference = ({ group, version, kind }) => [group || 'core', version, kind].join('~');

export const referenceForModel = (model) =>
  getReference({ group: model.apiGroup, version: model.apiVersion, kind: model.kind });
