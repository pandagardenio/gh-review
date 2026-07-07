/**
 * Agent-identity classification: the signals that mark a commit or PR as written
 * by a coding agent rather than typed by a person, and the functions that apply
 * them. This is the input to the provenance share (BL-022) — "how much of our
 * code is agent-authored".
 *
 * Aggregation-key discipline (CONTROL-ROOM-CONSTITUTION.md principle 1): the
 * classifier reduces a commit/PR to a {@link ProvenanceClass} — `agent` (a
 * harness name) or `human` — and discards the person. No login or email of a
 * human ever leaves this module; the `human` bucket is anonymous.
 *
 * The config is **product surface**, like the categorization rules (MVP.md §3):
 * one editable structure with sensible defaults, meant to be tuned deliberately.
 */

import type { CommitRecord, PullRecord } from '../model/github.js';

/** One classification signal: a case-insensitive `match` → the `agent` to attribute. */
export interface AgentSignal {
  /** Substring (trailers/logins) or branch prefix, compared case-insensitively. */
  readonly match: string;
  /** Agent identity to attribute, e.g. `claude-code`. */
  readonly agent: string;
}

/** The signals that mark agent work. Each list is tried in order, first match wins. */
export interface AgentIdentityConfig {
  /** `Co-Authored-By` trailer values that mark agent authorship. */
  readonly trailers: readonly AgentSignal[];
  /** Head-branch prefixes that mark agent authorship (PR signal). */
  readonly branchPrefixes: readonly AgentSignal[];
  /** Author-login substrings that mark a known coding-agent bot. */
  readonly botLogins: readonly AgentSignal[];
}

export type Provenance = 'agent' | 'human';

/** The classifier's whole output — provenance plus agent identity, never a person. */
export interface ProvenanceClass {
  readonly provenance: Provenance;
  /** Agent identity when `provenance` is `agent`; null for `human`. */
  readonly agent: string | null;
}

const HUMAN: ProvenanceClass = { provenance: 'human', agent: null };
const BOT_SUFFIX = '[bot]';

/** Sensible defaults covering the common coding agents. Tune per fleet. */
export const DEFAULT_AGENT_IDENTITY: AgentIdentityConfig = {
  trailers: [
    { match: 'claude', agent: 'claude-code' },
    { match: 'anthropic', agent: 'claude-code' },
    { match: 'copilot', agent: 'copilot' },
    { match: 'cursor', agent: 'cursor' },
    { match: 'devin', agent: 'devin' },
  ],
  branchPrefixes: [
    { match: 'claude/', agent: 'claude-code' },
    { match: 'codex/', agent: 'codex' },
    { match: 'cursor/', agent: 'cursor' },
    { match: 'devin/', agent: 'devin' },
    { match: 'copilot/', agent: 'copilot' },
  ],
  botLogins: [
    { match: 'copilot', agent: 'copilot' },
    { match: 'claude', agent: 'claude-code' },
    { match: 'devin', agent: 'devin' },
    { match: 'cursor', agent: 'cursor' },
  ],
};

/** Extract `Co-Authored-By` trailer values from a commit message, lowercased. */
export function coAuthorTrailers(message: string): string[] {
  const out: string[] = [];
  for (const line of message.split('\n')) {
    const match = /^\s*co-authored-by:\s*(.+)$/i.exec(line);
    const value = match?.[1];
    if (value) out.push(value.trim().toLowerCase());
  }
  return out;
}

/** Resolve a bot author login to an agent identity, or null when it is not a bot. */
function matchBotLogin(login: string | null, config: AgentIdentityConfig): string | null {
  if (!login) return null;
  const lower = login.toLowerCase();
  for (const rule of config.botLogins) {
    if (lower.includes(rule.match.toLowerCase())) return rule.agent;
  }
  // Any other `*[bot]` login is still machine authorship — attribute it under its
  // own derived name (e.g. `github-actions`) so it is visible, not lumped with a person.
  if (lower.endsWith(BOT_SUFFIX)) return login.slice(0, login.length - BOT_SUFFIX.length);
  return null;
}

/**
 * Classify a commit. A `Co-Authored-By` agent trailer wins over the author: the
 * agent wrote the code, the human steered it (documented choice, BL-022). Failing
 * a trailer, a bot author login marks agent work; otherwise the commit is `human`.
 */
export function classifyCommit(
  commit: CommitRecord,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): ProvenanceClass {
  const trailers = coAuthorTrailers(commit.message);
  for (const rule of config.trailers) {
    const needle = rule.match.toLowerCase();
    if (trailers.some((trailer) => trailer.includes(needle))) {
      return { provenance: 'agent', agent: rule.agent };
    }
  }
  const bot = matchBotLogin(commit.authorLogin, config);
  if (bot) return { provenance: 'agent', agent: bot };
  return HUMAN;
}

/**
 * Classify a PR by its head-branch prefix (a human opening a PR from `claude/…`
 * is surfacing agent work) then its author login. Otherwise `human`.
 */
export function classifyPull(
  pull: PullRecord,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): ProvenanceClass {
  const branch = pull.branch?.toLowerCase() ?? '';
  for (const rule of config.branchPrefixes) {
    if (branch.startsWith(rule.match.toLowerCase())) {
      return { provenance: 'agent', agent: rule.agent };
    }
  }
  const bot = matchBotLogin(pull.authorLogin, config);
  if (bot) return { provenance: 'agent', agent: bot };
  return HUMAN;
}
