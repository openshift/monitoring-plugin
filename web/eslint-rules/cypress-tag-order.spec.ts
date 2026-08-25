import { RuleTester } from 'eslint';
import { classifyTag, cypressTagOrder, sortTags } from './cypress-tag-order';

describe('classifyTag', () => {
  it('classifies modifier tags', () => {
    expect(classifyTag('@slow')).toBe('modifier');
    expect(classifyTag('@smoke')).toBe('modifier');
  });

  it('classifies high level component tags as features', () => {
    expect(classifyTag('@monitoring')).toBe('feature');
    expect(classifyTag('@cluster-health-analyzer')).toBe('feature');
  });

  it('classifies @x-y specific feature tags as features', () => {
    expect(classifyTag('@perses-dev')).toBe('feature');
    expect(classifyTag('@JIRA-1234')).toBe('feature');
  });

  it('classifies unrecognized tags as unknown', () => {
    expect(classifyTag('@perses')).toBe('unknown');
    expect(classifyTag('@acm')).toBe('unknown');
    expect(classifyTag('@ols')).toBe('unknown');
  });
});

describe('sortTags', () => {
  it('sorts features alphabetically before modifiers alphabetically', () => {
    expect(sortTags(['@slow', '@virtualization', '@demo', '@alerts'])).toEqual([
      '@alerts',
      '@virtualization',
      '@demo',
      '@slow',
    ]);
  });

  it('places unknown tags last', () => {
    expect(sortTags(['@slow', '@perses', '@alerts'])).toEqual(['@alerts', '@slow', '@perses']);
  });
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

ruleTester.run('cypress-tag-order', cypressTagOrder, {
  valid: [
    { code: "describe('x', { tags: ['@alerts', '@virtualization', '@demo', '@slow'] }, () => {})" },
    { code: "describe('x', { tags: ['@monitoring'] }, () => {})" },
    { code: "describe('x', { tags: ['@slow'] }, () => {})" },
    { code: "it('x', { tags: ['@perses-dev', '@slow'] }, () => {})" },
    { code: "it('x', { tags: ['@alerts', '@coo'] }, () => {})" },
  ],
  invalid: [
    {
      code: "describe('x', { tags: ['@slow', '@alerts'] }, () => {})",
      output: "describe('x', { tags: ['@alerts', '@slow'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }],
    },
    {
      code: "describe('x', { tags: ['@virtualization', '@alerts'] }, () => {})",
      output: "describe('x', { tags: ['@alerts', '@virtualization'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }],
    },
    {
      code: "it('x', { tags: ['@slow', '@demo'] }, () => {})",
      output: "it('x', { tags: ['@demo', '@slow'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }],
    },
    {
      code: "describe('x', { tags: ['@perses', '@alerts'] }, () => {})",
      output: "describe('x', { tags: ['@alerts', '@perses'] }, () => {})",
      errors: [{ messageId: 'tagsNotSorted' }, { messageId: 'unknownTag' }],
    },
  ],
});
