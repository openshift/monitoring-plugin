import { RuleTester } from 'eslint';
import { fileNaming } from './file-naming';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

ruleTester.run('file-naming', fileNaming, {
  valid: [
    { code: '', filename: '/src/features/alerts/MyComponent.tsx' },
    { code: '', filename: '/src/shared/utils/my-utils.ts' },
    { code: '', filename: '/src/shared/hooks/useMyHook.ts' },
    { code: '', filename: '/src/shared/hooks/useMyHook.tsx' },
    { code: '', filename: '/src/shared/hooks/useMyHook.spec.tsx' },
    { code: '', filename: '/src/features/alerts/MyComponent.spec.tsx' },
    { code: '', filename: '/src/shared/utils/my-utils.spec.ts' },
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
      filename: '/src/shared/utils/MyUtils.spec.ts',
      errors: [{ messageId: 'invalidTsName' }],
    },
  ],
});
