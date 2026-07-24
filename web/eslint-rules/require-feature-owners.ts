import fs from 'node:fs';
import path from 'node:path';
import type { Rule } from 'eslint';

const FEATURES_MARKER = path.join('src', 'features') + path.sep;

export function createRequireFeatureOwners(
  existsSync: (p: string) => boolean = fs.existsSync,
): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Require an OWNERS file in the root of every feature directory under src/features/',
      },
      schema: [],
      messages: {
        missingOwners:
          'Feature directory "src/features/{{feature}}" is missing an OWNERS file. ' +
          'Add an OWNERS file to define reviewers and approvers for this feature.',
      },
    },
    create(context) {
      const filename = context.filename;
      const markerIndex = filename.indexOf(FEATURES_MARKER);

      if (markerIndex === -1) {
        return {};
      }

      const afterMarker = filename.slice(markerIndex + FEATURES_MARKER.length);
      const feature = afterMarker.split(path.sep)[0];
      const featureDir = filename.slice(0, markerIndex + FEATURES_MARKER.length + feature.length);
      const ownersPath = path.join(featureDir, 'OWNERS');

      if (!existsSync(ownersPath)) {
        context.report({
          loc: { line: 1, column: 0 },
          messageId: 'missingOwners',
          data: { feature },
        });
      }

      return {};
    },
  };
}

export const requireFeatureOwners = createRequireFeatureOwners();
