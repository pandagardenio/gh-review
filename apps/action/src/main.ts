/**
 * Autoreview action entry point (BL-016).
 *
 * Wires GitHub I/O around the engine's pure decision: read the PR's files,
 * categorize them, evaluate the configured policy, and either auto-approve the
 * null case or post a neutral "human review required" comment. The plugin never
 * approves; this is the separate, opt-in CI surface that deliberately does
 * (justified in CONSTITUTION.md and MVP.md §9).
 */

import { existsSync, readFileSync } from 'node:fs';
import { categorize, evaluateAutoReview, mapApiFiles } from '@triage/engine';
import { resolvePolicy } from './config.js';
import { readActionContext } from './context.js';
import { GitHubClient } from './github.js';
import { buildReviewBody } from './summary.js';

const readFile = (path: string): string | null =>
  existsSync(path) ? readFileSync(path, 'utf8') : null;

async function run(): Promise<void> {
  const ctx = readActionContext(process.env, readFile);
  const policy = resolvePolicy(process.env, readFile);

  const apiBase = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const gh = new GitHubClient(ctx.token, ctx.owner, ctx.repo, apiBase);

  const files = await gh.listPullRequestFiles(ctx.prNumber);
  const decision = evaluateAutoReview(categorize(mapApiFiles(files)), policy);
  const body = buildReviewBody(decision, policy);

  console.log(`Autoreview #${ctx.prNumber}: ${decision.outcome} — ${decision.reason}`);
  const result = await gh.submitDecision(ctx.prNumber, ctx.headSha, decision, body);
  console.log(`Action taken: ${result.kind}`);
}

run().catch((error: unknown) => {
  console.error(`Autoreview failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
