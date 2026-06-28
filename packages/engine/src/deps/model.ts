/**
 * Dependency-expansion model (BL-004).
 *
 * Surfaces the *semantic* change in a `package.json` — added / bumped / removed
 * dependencies — so the reviewer never has to read a raw JSON diff (Constitution
 * principle 1). We organize, we don't judge: no freshness or vulnerability
 * verdicts (principle 4).
 */

/** The four npm dependency sections we expand. */
export type DependencyKind =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies';

export type DependencyChangeType = 'added' | 'bumped' | 'removed';

/** One dependency's delta within a section. */
export interface DependencyChange {
  readonly name: string;
  readonly kind: DependencyKind;
  readonly change: DependencyChangeType;
  /** Prior version — present for `removed` and `bumped`. */
  readonly previousVersion?: string;
  /** New version — present for `added` and `bumped`. */
  readonly version?: string;
}
