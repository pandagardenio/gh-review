/**
 * A deliberately small reader for `.factory/policy.yml`.
 *
 * The Configure pane shows the raw file (read-only) plus a few extracted
 * highlights — concurrency, token budgets, and the approval gates. We extract
 * only those flat, stable fields with line scans rather than pulling in a full
 * YAML parser; the raw text is always available as the source of truth, and
 * editing happens as a PR on GitHub (an approval-gate path itself), never here.
 */

import type { ApprovalGate, PolicySummary } from './source.js';

function findNumber(lines: readonly string[], key: string): number | null {
  const re = new RegExp(`^\\s*${key}:\\s*([0-9]+)\\b`);
  for (const line of lines) {
    const m = re.exec(line);
    if (m?.[1]) return Number(m[1]);
  }
  return null;
}

/**
 * Drop a trailing YAML inline comment (`# …`) that sits outside quotes, so a
 * documented gate (`- pattern: infra/** # only infra`) still parses. A `#`
 * inside a quoted value, or one not preceded by whitespace, is left intact.
 */
function stripInlineComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1] ?? ''))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function extractGates(lines: readonly string[]): ApprovalGate[] {
  const gates: ApprovalGate[] = [];
  let inGates = false;
  for (const raw of lines) {
    if (/^approvalGates:\s*$/.test(raw)) {
      inGates = true;
      continue;
    }
    // A new top-level key (non-indented, non-comment) ends the section.
    if (inGates && /^[A-Za-z]/.test(raw)) break;
    if (!inGates) continue;
    // Match against the comment-stripped line; quotes keep a literal `#` in the
    // value, while a trailing ` # …` comment is removed before matching.
    const line = stripInlineComment(raw);
    const pattern = /-\s*pattern:\s*["']?([^"']+?)["']?\s*$/.exec(line);
    const label = /-\s*label:\s*["']?([^"']+?)["']?\s*$/.exec(line);
    const reviewer = /reviewer:\s*["']?([^"']+?)["']?\s*$/.exec(line);
    if (pattern?.[1]) gates.push({ pattern: pattern[1].trim(), reviewer: 'human' });
    else if (label?.[1]) gates.push({ label: label[1].trim(), reviewer: 'human' });
    else if (reviewer?.[1] && gates.length > 0) {
      // Attach the reviewer to the gate it follows.
      const last = gates[gates.length - 1];
      if (last) gates[gates.length - 1] = { ...last, reviewer: reviewer[1].trim() };
    }
  }
  return gates;
}

/** Parse the highlighted fields out of raw policy.yml text. */
export function parsePolicy(raw: string): PolicySummary {
  const lines = raw.split('\n');
  return {
    maxConcurrency: findNumber(lines, 'maxConcurrency'),
    perWorkItemMaxTokens: findNumber(lines, 'maxTokens'),
    perDayMaxTokens: null,
    approvalGates: extractGates(lines),
    raw,
  };
}
