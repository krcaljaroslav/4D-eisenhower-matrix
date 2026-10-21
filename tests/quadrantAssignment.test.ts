import { describe, expect, it } from 'vitest';
import baseline from './fixtures/tags-1.0.40.json';
import { parseTaskLine } from '../src/core/parser.ts';
import { moveLineQuadrant, updateLineTextAndTags } from '../src/core/lineOps.ts';
import { applyQuadrantRules, DEFAULT_QUADRANT_RULES, normalizeQuadrantRules } from '../src/core/quadrantRules.ts';
import { QUADRANTS, type Task } from '../src/core/types.ts';
import { addDaysISO, formatDateISO } from '../src/core/taskUtils.ts';

const today = '2026-10-22';
function task(raw: string): Task {
  return { ...parseTaskLine(raw, 0)!, sourceFile: 'a.md', isFromDnes: false, isBlocked: false,
    blockedByTasks: [], blocksTasks: [], missingBlockers: [], hasCircularDependency: false };
}
function assigned(raw: string) {
  return applyQuadrantRules([task(raw)], 'rules', DEFAULT_QUADRANT_RULES, today)[0];
}

describe('explicit and automatic quadrants', () => {
  it.each(QUADRANTS)('pins %s and returns to automatic through the same line operation', (quadrant) => {
    const raw = '- [ ] ⏫ Task 📅 2026-10-22';
    const pinned = moveLineQuadrant(raw, quadrant, true).newLine;
    expect(pinned).toBe(`- [ ] #${quadrant} ⏫ Task 📅 2026-10-22`);
    expect(assigned(pinned)).toMatchObject({ quadrant, explicitQuadrant: quadrant, automaticQuadrant: false });
    const automatic = moveLineQuadrant(pinned, 'OPEN').newLine;
    expect(automatic).toBe(raw);
    expect(assigned(automatic)).toMatchObject({ quadrant: 'DO', automaticQuadrant: true });
  });
  it('recognizes only the first tag as an explicit quadrant and replaces OPEN', () => {
    expect(task('- [ ] #open Work')).toMatchObject({ quadrant: 'OPEN', explicitQuadrant: 'OPEN', contextTags: [] });
    expect(task('- [ ] #context #OPEN Work').explicitQuadrant).toBeUndefined();
    expect(moveLineQuadrant('- [ ] #OPEN Work', 'DECIDE').newLine).toBe('- [ ] #DECIDE Work');
    expect(updateLineTextAndTags('- [ ] #OPEN Work', 'Edited', []).newLine).toBe('- [ ] #OPEN Edited');
  });
  it('leaves all untagged tasks OPEN when every rule is disabled', () => {
    const rules = normalizeQuadrantRules(Object.fromEntries(QUADRANTS.map(q => [q, { enabled: false }])));
    expect(applyQuadrantRules([task('- [ ] ⏫ Work 📅 2026-10-22')], 'rules', rules, today)[0].quadrant).toBe('OPEN');
  });
  it.each(['', ' ', 'oops', -1, null, Infinity])('rejects invalid persisted dueDays %s', (dueDays) => {
    expect(normalizeQuadrantRules({ DO: { dueDays } }).DO.dueDays).toBe(7);
  });
  it('uses local calendar days across midnight and DST', () => {
    expect(formatDateISO(new Date(2026, 9, 22, 0, 1))).toBe(today);
    expect(addDaysISO('2026-10-25', 1)).toBe('2026-10-26');
  });
  it.each(['2026-10-21', today, '2026-10-23', '2026-10-24', undefined])('assigns date boundary %s', due => {
    expect(assigned(`- [ ] ⏫ Work${due ? ` 📅 ${due}` : ''}`).quadrant)
      .toBe(due && due <= '2026-10-23' ? 'DO' : 'DECIDE');
  });
  it('matches the actual 1.0.40 parser and move outputs in tags mode', () => {
    expect(baseline.commit).toBe('25cdd18');
    for (const fixture of baseline.fixtures) {
      const { raw } = fixture;
      const { explicitQuadrant, ...parsed } = parseTaskLine(raw, 0)!;
      expect(JSON.parse(JSON.stringify(parsed))).toEqual(fixture.parsed);
      const tasks = [task(raw)];
      expect(applyQuadrantRules(tasks, 'tags', DEFAULT_QUADRANT_RULES, today)).toBe(tasks);
      for (const quadrant of QUADRANTS) expect(moveLineQuadrant(raw, quadrant)).toEqual(fixture.moves[quadrant]);
    }
  });
});
