import { RuleTester } from 'eslint';
import { cypressTagsArray } from './cypress-tags-array';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

ruleTester.run('cypress-tags-array', cypressTagsArray, {
  valid: [
    { code: "describe('x', { tags: ['@monitoring'] }, () => {})" },
    { code: "describe('x', { tags: ['@alerts', '@slow'] }, () => {})" },
    { code: "const config = { tags: '@internal' };" },
  ],
  invalid: [
    {
      code: "describe('x', { tags: '@monitoring' }, () => {})",
      output: "describe('x', { tags: ['@monitoring'] }, () => {})",
      errors: [{ messageId: 'tagsMustBeArray' }],
    },
    {
      code: "it('x', { tags: '@slow' }, () => {})",
      output: "it('x', { tags: ['@slow'] }, () => {})",
      errors: [{ messageId: 'tagsMustBeArray' }],
    },
  ],
});
