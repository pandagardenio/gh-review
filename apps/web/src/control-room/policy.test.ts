import { describe, expect, it } from 'vitest';
import { parsePolicy } from './policy.js';

const SAMPLE = `version: 1

concurrency:
  maxConcurrency: 3
  lockTtlMinutes: 10

budgets:
  perWorkItem:
    maxTokens: 500000

approvalGates:
  - pattern: "infra/**"
    reviewer: human
  - pattern: ".factory/policy.yml"
    reviewer: human
  - label: "release"
    reviewer: human

labels:
  stages: []
`;

describe('parsePolicy', () => {
  it('extracts concurrency and the per-WorkItem token budget', () => {
    const p = parsePolicy(SAMPLE);
    expect(p.maxConcurrency).toBe(3);
    expect(p.perWorkItemMaxTokens).toBe(500000);
  });

  it('extracts path and label approval gates, stopping at the next top-level key', () => {
    const p = parsePolicy(SAMPLE);
    expect(p.approvalGates).toEqual([
      { pattern: 'infra/**', reviewer: 'human' },
      { pattern: '.factory/policy.yml', reviewer: 'human' },
      { label: 'release', reviewer: 'human' },
    ]);
  });

  it('preserves the raw text as the source of truth', () => {
    const p = parsePolicy(SAMPLE);
    expect(p.raw).toBe(SAMPLE);
  });

  it('degrades gracefully on empty input', () => {
    const p = parsePolicy('');
    expect(p.maxConcurrency).toBeNull();
    expect(p.approvalGates).toEqual([]);
  });
});
