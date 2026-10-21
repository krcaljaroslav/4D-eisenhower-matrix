import { describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import {
  collectPropertyKeys,
  passesPropertyFilter,
  noteMatchesAllProperties,
  noteMatchesProperty,
  normalizePropertyFilters,
  notePropertyValues,
  propertyValueStrings,
} from '../src/obsidian-adapter/properties.ts';

import { isExcludedPath } from '../src/core/fileScope.ts';

function fakeApp(files: Record<string, Record<string, unknown> | undefined>): App {
  const tfiles = Object.keys(files).map((path) => ({ path }) as TFile);
  return {
    vault: { getMarkdownFiles: () => tfiles },
    metadataCache: {
      getFileCache: (f: TFile) => (files[f.path] ? { frontmatter: files[f.path] } : null),
      getCache: (path: string) => (files[path] ? { frontmatter: files[path] } : null),
    },
  } as unknown as App;
}

describe('propertyValueStrings', () => {
  it('flattens lists and scalars, drops empties and objects', () => {
    expect(propertyValueStrings(['a', ' b ', '', null, { x: 1 }, 3])).toEqual(['a', 'b', '3']);
    expect(propertyValueStrings('solo')).toEqual(['solo']);
    expect(propertyValueStrings(true)).toEqual(['true']);
    expect(propertyValueStrings(null)).toEqual([]);
  });
});

describe('isExcludedPath', () => {
  it('matches the folder and its descendants only', () => {
    expect(isExcludedPath('templates/a.md', ['templates'])).toBe(true);
    expect(isExcludedPath('templates', ['templates'])).toBe(true);
    expect(isExcludedPath('templates-old/a.md', ['templates'])).toBe(false);
  });
});

describe('collectPropertyKeys', () => {
  it('gathers sorted keys only from loaded task sources', () => {
    const app = fakeApp({
      'a.md': { context: ['Remitly', 'career'], type: 'note' },
      'b.md': { context: 'remitly-ops', status: null },
      'tpl/c.md': { templateOnly: 'hidden' },
      'unused.md': { unusedOnly: 'no loaded tasks' },
      'd.md': undefined,
    });
    const readCache = vi.spyOn(app.metadataCache, 'getCache');
    const scanVault = vi.spyOn(app.vault, 'getMarkdownFiles');
    const tasks = ['a.md', 'b.md', 'a.md', 'd.md'].map((sourceFile) => ({ sourceFile }));
    expect(collectPropertyKeys(app, tasks)).toEqual(['context', 'status', 'type']);
    expect(readCache.mock.calls.map(([path]) => path)).toEqual(['a.md', 'b.md', 'd.md']);
    expect(scanVault).not.toHaveBeenCalled();
    expect(collectPropertyKeys(app, [])).toEqual([]);
  });
});

describe('noteMatchesProperty', () => {
  const app = fakeApp({
    'list.md': { context: ['Remitly', 'career'] },
    'scalar.md': { context: 'personal' },
    'none.md': { other: 'x' },
  });

  it('passes everything when no key is set', () => {
    expect(noteMatchesProperty(app, 'none.md', '', [])).toBe(true);
  });

  it('requires the property when no values are selected', () => {
    expect(noteMatchesProperty(app, 'scalar.md', 'context', [])).toBe(true);
    expect(noteMatchesProperty(app, 'none.md', 'context', [])).toBe(false);
  });

  it('matches any selected value, case-insensitively and exactly', () => {
    expect(noteMatchesProperty(app, 'list.md', 'context', ['remitly'])).toBe(true);
    expect(noteMatchesProperty(app, 'scalar.md', 'context', ['remitly', 'personal'])).toBe(true);
    expect(noteMatchesProperty(app, 'list.md', 'context', ['remit'])).toBe(false);
  });
});

describe('notePropertyValues', () => {
  it('returns null when the property is missing', () => {
    const app = fakeApp({ 'a.md': { context: ['x', 'y'] }, 'b.md': { other: 1 } });
    expect(notePropertyValues(app, 'a.md', 'context')).toEqual(['x', 'y']);
    expect(notePropertyValues(app, 'b.md', 'context')).toBeNull();
    expect(notePropertyValues(app, 'missing.md', 'context')).toBeNull();
  });
});

describe('noteMatchesAllProperties', () => {
  const app = fakeApp({
    'both.md': { context: ['work'], project: 'alpha' },
    'ctx.md': { context: 'work' },
    'proj.md': { project: 'alpha' },
  });
  const filters = [
    { key: 'context', values: ['work'] },
    { key: 'project', values: ['alpha'] },
  ];

  it('requires every filter to match (AND)', () => {
    expect(noteMatchesAllProperties(app, 'both.md', filters)).toBe(true);
    expect(noteMatchesAllProperties(app, 'ctx.md', filters)).toBe(false);
    expect(noteMatchesAllProperties(app, 'proj.md', filters)).toBe(false);
  });

  it('passes everything with no filters', () => {
    expect(noteMatchesAllProperties(app, 'proj.md', [])).toBe(true);
  });
});

describe('normalizePropertyFilters', () => {
  it('drops malformed and keyless entries', () => {
    expect(
      normalizePropertyFilters([
        { key: 'context', values: ['work', 3] },
        { key: '', values: [] },
        { key: 'x' },
        null,
      ]),
    ).toEqual([{ key: 'context', values: ['work'] }]);
    expect(normalizePropertyFilters('nope')).toEqual([]);
  });
});

describe('passesPropertyFilter', () => {
  const ordinaryTask = { sourceFile: 'other.md', isFromDnes: false };
  const todayTask = { sourceFile: 'daily.md', isFromDnes: true };
  const matchedFiles = new Set(['matching.md']);

  it('ignores saved property filters when the setting is off', () => {
    expect(passesPropertyFilter(ordinaryTask, false, matchedFiles)).toBe(true);
    expect(passesPropertyFilter(ordinaryTask, true, matchedFiles)).toBe(false);
  });

  it("always passes tasks from today's daily note", () => {
    expect(passesPropertyFilter(todayTask, true, matchedFiles)).toBe(true);
    expect(passesPropertyFilter(todayTask, true, new Set())).toBe(true);
  });

  it('passes matching sources and inactive filters', () => {
    expect(passesPropertyFilter({ ...ordinaryTask, sourceFile: 'matching.md' }, true, matchedFiles)).toBe(true);
    expect(passesPropertyFilter(ordinaryTask, true, null)).toBe(true);
  });
});
