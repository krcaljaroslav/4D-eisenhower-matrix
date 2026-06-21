import { describe, expect, it } from 'vitest';
import { addDaysISO, matchesDueFilter } from '../src/core/taskUtils.ts';
import type { Task } from '../src/core/types.ts';

function task(dueDate?: string): Task {
  return {
    lineIndex: 0,
    raw: '',
    status: ' ',
    checked: false,
    text: 'x',
    quadrant: 'DO',
    contextTags: [],
    dueDate,
    sourceFile: 'f.md',
    isFromDnes: false,
  };
}

const TODAY = '2026-06-15';
// Datum vybrané v horní liště — odlišné od TODAY, ať 'selected' testuje
// porovnání proti vybranému dni, ne proti dnešku.
const SELECTED = '2026-06-20';

describe('addDaysISO', () => {
  it('adds days within a month', () => {
    expect(addDaysISO('2026-06-15', 7)).toBe('2026-06-22');
  });
  it('rolls over month boundary', () => {
    expect(addDaysISO('2026-06-28', 7)).toBe('2026-07-05');
  });
});

describe('matchesDueFilter', () => {
  it('none → everything passes (incl. no due date)', () => {
    expect(matchesDueFilter(task(), 'none', TODAY, SELECTED)).toBe(true);
    expect(matchesDueFilter(task('2026-12-31'), 'none', TODAY, SELECTED)).toBe(true);
  });

  it('today → overdue + due today, not future', () => {
    expect(matchesDueFilter(task('2026-06-10'), 'today', TODAY, SELECTED)).toBe(true); // overdue
    expect(matchesDueFilter(task('2026-06-15'), 'today', TODAY, SELECTED)).toBe(true); // today
    expect(matchesDueFilter(task('2026-06-16'), 'today', TODAY, SELECTED)).toBe(false); // tomorrow
    expect(matchesDueFilter(task(), 'today', TODAY, SELECTED)).toBe(false); // no due
  });

  it('week → overdue + due within 7 days, not beyond', () => {
    expect(matchesDueFilter(task('2026-06-10'), 'week', TODAY, SELECTED)).toBe(true); // overdue
    expect(matchesDueFilter(task('2026-06-15'), 'week', TODAY, SELECTED)).toBe(true); // today
    expect(matchesDueFilter(task('2026-06-22'), 'week', TODAY, SELECTED)).toBe(true); // +7
    expect(matchesDueFilter(task('2026-06-23'), 'week', TODAY, SELECTED)).toBe(false); // +8
    expect(matchesDueFilter(task(), 'week', TODAY, SELECTED)).toBe(false); // no due
  });

  it('selected → only due exactly on the selected date, no overdue', () => {
    expect(matchesDueFilter(task('2026-06-20'), 'selected', TODAY, SELECTED)).toBe(true); // = selected
    expect(matchesDueFilter(task('2026-06-10'), 'selected', TODAY, SELECTED)).toBe(false); // overdue not included
    expect(matchesDueFilter(task('2026-06-15'), 'selected', TODAY, SELECTED)).toBe(false); // today ≠ selected
    expect(matchesDueFilter(task('2026-06-21'), 'selected', TODAY, SELECTED)).toBe(false); // next day
    expect(matchesDueFilter(task(), 'selected', TODAY, SELECTED)).toBe(false); // no due
  });
});
