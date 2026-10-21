import type { App } from 'obsidian';

/** Flattens a frontmatter value into comparable strings (list items, scalars). */
export function propertyValueStrings(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  return items
    .filter((v) => v !== null && v !== undefined && typeof v !== 'object')
    .map((v) => String(v).trim())
    .filter((v) => v !== '');
}

/** Sorted property keys from the loaded tasks' source files only. */
export function collectPropertyKeys(app: App, tasks: readonly { sourceFile: string }[]): string[] {
  const keys = new Set<string>();
  for (const path of new Set(tasks.map((task) => task.sourceFile))) {
    const frontmatter = app.metadataCache.getCache(path)?.frontmatter;
    if (frontmatter) for (const key of Object.keys(frontmatter)) keys.add(key);
  }
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Today's daily tasks bypass property filters; disabling the UI disables filtering too. */
export function passesPropertyFilter(
  task: { isFromDnes: boolean; sourceFile: string },
  enabled: boolean,
  matchedFiles: ReadonlySet<string> | null,
): boolean {
  return !enabled || task.isFromDnes || matchedFiles === null || matchedFiles.has(task.sourceFile);
}

/** Values of `key` in the note at `path`, or null when the note lacks the property. */
export function notePropertyValues(app: App, path: string, key: string): string[] | null {
  const fm = app.metadataCache.getCache(path)?.frontmatter;
  if (!fm || !(key in fm)) return null;
  return propertyValueStrings(fm[key]);
}

/**
 * True when the note's property has any of `values` (case-insensitive exact
 * match). No key = always true; no values = the property just has to exist.
 */
export function noteMatchesProperty(app: App, path: string, key: string, values: string[]): boolean {
  if (!key) return true;
  const actual = notePropertyValues(app, path, key);
  if (actual === null) return false;
  if (values.length === 0) return true;
  const wanted = new Set(values.map((v) => v.toLowerCase()));
  return actual.some((v) => wanted.has(v.toLowerCase()));
}

/** One property filter row: a key and the accepted values (OR). Empty key = inactive. */
export type PropertyFilter = { key: string; values: string[] };

/** True when the note passes every active filter (AND across filters). */
export function noteMatchesAllProperties(app: App, path: string, filters: PropertyFilter[]): boolean {
  return filters.every((f) => noteMatchesProperty(app, path, f.key, f.values));
}

/** Drops malformed entries from persisted settings. */
export function normalizePropertyFilters(raw: unknown): PropertyFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is PropertyFilter => !!f && typeof f.key === 'string' && Array.isArray(f.values))
    .map((f) => ({ key: f.key, values: f.values.filter((v): v is string => typeof v === 'string') }))
    .filter((f) => f.key !== '');
}
