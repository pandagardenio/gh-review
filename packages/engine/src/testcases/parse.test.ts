import { describe, expect, it } from 'vitest';
import { parseTestCases } from './parse.js';

describe('parseTestCases', () => {
  it('classifies added, deleted, and changed cases in a spec', () => {
    const patch = [
      '@@ -1,10 +1,11 @@',
      " describe('math', () => {",
      "   it('adds', () => {",
      '-    expect(add(1, 1)).toBe(1);',
      '+    expect(add(1, 1)).toBe(2);',
      '   });',
      "-  it('subtracts', () => {",
      '-    expect(sub(2, 1)).toBe(1);',
      '-  });',
      "+  it('multiplies', () => {",
      '+    expect(mul(2, 3)).toBe(6);',
      '+  });',
      ' });',
    ].join('\n');

    expect(parseTestCases(patch)).toEqual([
      { title: 'adds', kind: 'case', status: 'changed' },
      { title: 'subtracts', kind: 'case', status: 'deleted' },
      { title: 'multiplies', kind: 'case', status: 'added' },
    ]);
  });

  it('marks a case changed when only its body is touched (title stable)', () => {
    const patch = [
      '@@ -1,5 +1,5 @@',
      " it('keeps title', () => {",
      '-  const a = 1;',
      '+  const a = 2;',
      ' });',
    ].join('\n');
    expect(parseTestCases(patch)).toEqual([
      { title: 'keeps title', kind: 'case', status: 'changed' },
    ]);
  });

  it('classifies a case as changed when the title line itself changed but the title is stable', () => {
    const patch = [
      '@@ -1,3 +1,3 @@',
      "-  it('runs', () => {",
      "+  it('runs', async () => {",
      ' });',
    ].join('\n');
    expect(parseTestCases(patch)).toEqual([{ title: 'runs', kind: 'case', status: 'changed' }]);
  });

  it('reports an added suite', () => {
    const patch = [
      '@@ -0,0 +1,3 @@',
      "+describe('new suite', () => {",
      "+  it('works', () => {});",
      '+});',
    ].join('\n');
    expect(parseTestCases(patch)).toEqual([
      { title: 'new suite', kind: 'suite', status: 'added' },
      { title: 'works', kind: 'case', status: 'added' },
    ]);
  });

  it('handles it.only and template-literal titles', () => {
    const patch = [
      '@@ -0,0 +1,2 @@',
      '+  it.only(`focused`, () => {});',
      '+  test("plain", () => {});',
    ].join('\n');
    expect(parseTestCases(patch).map((c) => c.title)).toEqual(['focused', 'plain']);
  });

  it('does not report unchanged cases (context only, no body change)', () => {
    const patch = [
      '@@ -1,6 +1,6 @@',
      " it('stable', () => {",
      '   noop();',
      ' });',
      '-const x = 1;',
      '+const x = 2;',
    ].join('\n');
    // The trailing change is outside any case body (case context reset on suite/eof).
    expect(parseTestCases(patch).find((c) => c.title === 'stable')).toBeUndefined();
  });

  it('returns nothing for an empty patch', () => {
    expect(parseTestCases('')).toEqual([]);
  });
});
