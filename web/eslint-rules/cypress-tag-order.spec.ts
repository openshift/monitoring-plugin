import { RuleTester } from 'eslint';
import { classifyTag, cypressTagOrder, sortTags } from './cypress-tag-order';

describe('classifyTag', () => {
  it('classifies modifier tags', () => {
    expect(classifyTag('@slow')).toBe('modifier');
    expect(classifyTag('@coo')).toBe('modifier');
    expect(classifyTag('@virtualization')).toBe('modifier');
    expect(classifyTag('@ols')).toBe('modifier');
  });

  it('classifies high level component tags as features', () => {
    expect(classifyTag('@alerting')).toBe('feature');
    expect(classifyTag('@metrics')).toBe('feature');
    expect(classifyTag('@cluster-health-analyzer')).toBe('feature');
  });

  it('classifies @x-y specific feature tags as features', () => {
    expect(classifyTag('@perses-dev')).toBe('feature');
  });

  it('classifies unrecognized tags as unknown', () => {
    expect(classifyTag('@perses')).toBe('unknown');
    expect(classifyTag('@acm')).toBe('unknown');
    expect(classifyTag('@monitoring')).toBe('unknown');
  });
});

describe('sortTags', () => {
  it('sorts features alphabetically before modifiers alphabetically', () => {
    expect(sortTags(['@slow', '@metrics', '@coo', '@alerting'])).toEqual([
      '@alerting',
      '@metrics',
      '@coo',
      '@slow',
    ]);
  });

  it('places unknown tags last', () => {
    expect(sortTags(['@slow', '@perses', '@alerting'])).toEqual(['@alerting', '@slow', '@perses']);
  });
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

ruleTester.run('cypress-tag-order', cypressTagOrder, {
  valid: [
    { code: "describe('x', { tags: ['@alerting', '@metrics', '@coo', '@slow'] }, () => {})" },
    { code: "describe('x', { tags: ['@alerting'] }, () => {})" },
    { code: "describe('x', { tags: ['@slow'] }, () => {})" },
    { code: "it('x', { tags: ['@perses-dev', '@slow'] }, () => {})" },
    { code: "it('x', { tags: ['@alerting', '@coo'] }, () => {})" },
    { code: "const config = { tags: ['@slow', '@alerting'] };" },
  ],
  invalid: [
    {
      code: "describe('x', { tags: ['@slow', '@alerting'] }, () => {})",
      output: "describe('x', { tags: ['@alerting', '@slow'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }],
    },
    {
      code: "describe('x', { tags: ['@virtualization', '@alerting'] }, () => {})",
      output: "describe('x', { tags: ['@alerting', '@virtualization'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }],
    },
    {
      code: "it('x', { tags: ['@slow', '@metrics'] }, () => {})",
      output: "it('x', { tags: ['@metrics', '@slow'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }],
    },
    {
      code: "describe('x', { tags: ['@perses', '@alerting'] }, () => {})",
      output: "describe('x', { tags: ['@alerting', '@perses'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }, { messageId: 'unknownTag' }],
    },
  ],
});
