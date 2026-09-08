import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuleTester } from 'eslint';
import { fileNaming } from './file-naming';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

// Create a fixture directory so the mirrored-sibling check can hit real files.
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-naming-'));
const fixture = (name: string) => {
  const filePath = path.join(fixtureDir, name);
  fs.writeFileSync(filePath, '');
  return filePath;
};

// Siblings that spec files legitimately mirror.
fixture('DashboardDialogHelpers.tsx');
fixture('myUtils.ts');

ruleTester.run('file-naming', fileNaming, {
  valid: [
    { code: '', filename: '/src/features/alerts/MyComponent.tsx' },
    { code: '', filename: '/src/shared/utils/my-utils.ts' },
    { code: '', filename: '/src/shared/hooks/useMyHook.ts' },
    { code: '', filename: '/src/shared/hooks/useMyHook.tsx' },
    { code: '', filename: '/src/shared/hooks/useMyHook.spec.tsx' },
    { code: '', filename: '/src/features/alerts/MyComponent.spec.tsx' },
    { code: '', filename: '/src/shared/utils/my-utils.spec.ts' },
    // Spec files may mirror a PascalCase sibling (DashboardDialogHelpers.tsx exists)
    { code: '', filename: fixture('DashboardDialogHelpers.spec.ts') },
    { code: '', filename: fixture('DashboardDialogHelpers.test.ts') },
    // Spec files may mirror a camelCase sibling (myUtils.ts exists)
    { code: '', filename: fixture('myUtils.spec.ts') },
  ],
  invalid: [
    {
      code: '',
      filename: '/src/features/alerts/my-component.tsx',
      errors: [{ messageId: 'invalidTsxName' }],
    },
    {
      code: '',
      filename: '/src/shared/utils/MyUtils.ts',
      errors: [{ messageId: 'invalidTsName' }],
    },
    {
      code: '',
      filename: '/src/shared/utils/myUtils.ts',
      errors: [{ messageId: 'invalidTsName' }],
    },
    {
      code: '',
      filename: path.join(fixtureDir, 'NoSibling.spec.ts'),
      errors: [{ messageId: 'invalidTsName' }],
    },
  ],
});
