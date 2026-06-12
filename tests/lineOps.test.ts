import { describe, expect, it } from 'vitest';
import {
  appendTaskUnderHeading,
  buildTaskLine,
  moveLineQuadrant,
  setDueDateOnLine,
  setStatusOnLine,
  toggleLine,
  transformLineInContent,
  updateLineTextAndTags,
} from '../src/core/lineOps.ts';
import { parseTaskLine } from '../src/core/parser.ts';

describe('toggleLine', () => {
  it('unchecked → checked + ✅ today', () => {
    const r = toggleLine('- [ ] #DO hello', '2026-05-14');
    expect(r.checked).toBe(true);
    expect(r.newLine).toBe('- [x] #DO hello ✅ 2026-05-14');
  });
  it('checked → unchecked strips ✅', () => {
    const r = toggleLine('- [x] #DO done ✅ 2026-05-10', '2026-05-14');
    expect(r.checked).toBe(false);
    expect(r.newLine).toBe('- [ ] #DO done');
  });
  it('canceled [-] → toggle reopens to [ ]', () => {
    const r = toggleLine('- [-] #DO scratched', '2026-05-21');
    expect(r.checked).toBe(false);
    expect(r.newLine).toBe('- [ ] #DO scratched');
  });
  it('incomplete [/] → toggle marks done', () => {
    const r = toggleLine('- [/] #DO doing', '2026-05-21');
    expect(r.checked).toBe(true);
    expect(r.newLine).toBe('- [x] #DO doing ✅ 2026-05-21');
  });
  it('throws on non-task line', () => {
    expect(() => toggleLine('# Heading', '2026-05-14')).toThrow(/Not a task line/);
  });
});

describe('buildTaskLine', () => {
  it('DO_IMMEDIATELY with text only', () => {
    expect(buildTaskLine('DO_IMMEDIATELY', 'hello', '2026-05-14')).toBe(
      '- [ ] #DO_IMMEDIATELY 🛫 2026-05-14 hello',
    );
  });
  it('OPEN — no prefix tag', () => {
    expect(buildTaskLine('OPEN', 'capture', '2026-05-14')).toBe(
      '- [ ] 🛫 2026-05-14 capture',
    );
  });
  it('extracts leading context tags', () => {
    expect(buildTaskLine('DO_IMMEDIATELY', '#Osobní #Work test', '2026-05-14')).toBe(
      '- [ ] #DO_IMMEDIATELY #Osobní #Work 🛫 2026-05-14 test',
    );
  });
  it('with due date + priority', () => {
    expect(buildTaskLine('DO_IMMEDIATELY', 'urgent', '2026-05-14', '2026-05-20', 'highest')).toBe(
      '- [ ] #DO_IMMEDIATELY 🔺 📅 2026-05-20 🛫 2026-05-14 urgent',
    );
  });
  it('strips user-typed quadrant tags', () => {
    expect(buildTaskLine('OPEN', '#DO_IMMEDIATELY misplaced', '2026-05-14')).toBe(
      '- [ ] 🛫 2026-05-14 misplaced',
    );
  });
  it('builds with a non-default status ([/] in progress)', () => {
    expect(buildTaskLine('DO_IMMEDIATELY', 'doing', '2026-05-14', null, null, '/')).toBe(
      '- [/] #DO_IMMEDIATELY 🛫 2026-05-14 doing',
    );
  });
  it('builds done status [x] with ✅ today appended', () => {
    expect(buildTaskLine('SCHEDULE', 'finished', '2026-05-14', null, null, 'x')).toBe(
      '- [x] #SCHEDULE 🛫 2026-05-14 finished ✅ 2026-05-14',
    );
  });
});

describe('moveLineQuadrant', () => {
  it('replaces existing quadrant', () => {
    const r = moveLineQuadrant('- [ ] #DO #Work hello', 'SCHEDULE');
    expect(r.newLine).toBe('- [ ] #SCHEDULE #Work hello');
  });
  it('adds quadrant to OPEN task', () => {
    const r = moveLineQuadrant('- [ ] #Work hello', 'DELEGATE');
    expect(r.newLine).toBe('- [ ] #DELEGATE #Work hello');
  });
  it('removes quadrant when moving to OPEN', () => {
    const r = moveLineQuadrant('- [ ] #DO_IMMEDIATELY #Work hello', 'OPEN');
    expect(r.newLine).toBe('- [ ] #Work hello');
  });
});

describe('setStatusOnLine', () => {
  it('sets status to x adds ✅ today', () => {
    const r = setStatusOnLine('- [ ] #DO_IMMEDIATELY hello', 'x', '2026-05-21');
    expect(r.newLine).toBe('- [x] #DO_IMMEDIATELY hello ✅ 2026-05-21');
  });
  it('sets status to / and strips existing ✅', () => {
    const r = setStatusOnLine('- [x] #DO_IMMEDIATELY done ✅ 2026-05-10', '/', '2026-05-21');
    expect(r.newLine).toBe('- [/] #DO_IMMEDIATELY done');
  });
  it('sets status to - (canceled)', () => {
    const r = setStatusOnLine('- [ ] #DO_IMMEDIATELY nope', '-', '2026-05-21');
    expect(r.newLine).toBe('- [-] #DO_IMMEDIATELY nope');
  });
  it('accepts arbitrary single char like >', () => {
    const r = setStatusOnLine('- [ ] task', '>', '2026-05-21');
    expect(r.newLine).toBe('- [>] task');
  });
  it('throws on multi-char status', () => {
    expect(() => setStatusOnLine('- [ ] task', 'xx', '2026-05-21')).toThrow(/Invalid status/);
  });
});

describe('parseTaskLine — non-standard statuses', () => {
  it('parses [/] (incomplete) as not checked', () => {
    const p = parseTaskLine('- [/] #DO doing it', 0);
    expect(p).not.toBeNull();
    expect(p!.status).toBe('/');
    expect(p!.checked).toBe(false);
    expect(p!.text).toBe('doing it');
  });
  it('parses [-] (canceled) with status preserved', () => {
    const p = parseTaskLine('- [-] #DO scratch', 0);
    expect(p!.status).toBe('-');
    expect(p!.checked).toBe(false);
  });
  it('parses [>] (forwarded)', () => {
    const p = parseTaskLine('- [>] later', 0);
    expect(p!.status).toBe('>');
    expect(p!.checked).toBe(false);
  });
  it('parses [X] (uppercase done) as checked', () => {
    const p = parseTaskLine('- [X] capital done', 0);
    expect(p!.status).toBe('X');
    expect(p!.checked).toBe(true);
  });
});

describe('setDueDateOnLine', () => {
  it('adds 📅 when none', () => {
    const r = setDueDateOnLine('- [ ] #DO_IMMEDIATELY hello', '2026-05-20');
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY 📅 2026-05-20 hello');
  });
  it('replaces existing 📅', () => {
    const r = setDueDateOnLine('- [ ] #DO_IMMEDIATELY 📅 2026-04-30 hello', '2026-05-20');
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY 📅 2026-05-20 hello');
  });
  it('removes 📅 when null', () => {
    const r = setDueDateOnLine('- [ ] #DO_IMMEDIATELY 📅 2026-04-30 hello', null);
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY hello');
  });
});

describe('updateLineTextAndTags', () => {
  it('updates text + tags, preserves other parts', () => {
    const r = updateLineTextAndTags(
      '- [x] #DO_IMMEDIATELY #Work 📅 2026-05-20 🛫 2026-05-10 Send report ✅ 2026-05-15',
      'Send weekly report',
      ['#Urgent'],
    );
    expect(r.newLine).toBe(
      '- [x] #DO_IMMEDIATELY #Urgent 📅 2026-05-20 🛫 2026-05-10 Send weekly report ✅ 2026-05-15',
    );
  });

  it('tri-state dueDate: undefined preserves', () => {
    const r = updateLineTextAndTags(
      '- [ ] #DO_IMMEDIATELY 📅 2026-05-20 hello',
      'hello',
      [],
      {},
    );
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY 📅 2026-05-20 hello');
  });
  it('tri-state dueDate: null clears', () => {
    const r = updateLineTextAndTags(
      '- [ ] #DO_IMMEDIATELY 📅 2026-05-20 hello',
      'hello',
      [],
      { dueDate: null },
    );
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY hello');
  });
  it('tri-state dueDate: value sets', () => {
    const r = updateLineTextAndTags(
      '- [ ] #DO_IMMEDIATELY hello',
      'hello',
      [],
      { dueDate: '2026-05-25' },
    );
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY 📅 2026-05-25 hello');
  });

  it('tri-state priority: set', () => {
    const r = updateLineTextAndTags(
      '- [ ] #DO_IMMEDIATELY hello',
      'hello',
      [],
      { priority: 'high' },
    );
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY ⏫ hello');
  });
  it('tri-state priority: clear', () => {
    const r = updateLineTextAndTags(
      '- [ ] #DO_IMMEDIATELY ⏫ hello',
      'hello',
      [],
      { priority: null },
    );
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY hello');
  });

  it('normalizes tags (prepend #, dedupe)', () => {
    const r = updateLineTextAndTags(
      '- [ ] #DO_IMMEDIATELY hello',
      'hello',
      ['Osobní', '#osobní', '#Work'],
    );
    expect(r.newLine).toBe('- [ ] #DO_IMMEDIATELY #Osobní #Work hello');
  });
});

describe('appendTaskUnderHeading', () => {
  it('inserts after existing tasks under # Dnes', () => {
    const content = [
      '---',
      'date: 2026-05-14',
      '---',
      '',
      '# Dnes',
      '- [ ] #DO_IMMEDIATELY existing',
      '',
      '## Other',
    ].join('\n');
    const r = appendTaskUnderHeading(content, '# Dnes', 'new task', 'SCHEDULE', '2026-05-14');
    expect(r.lineIndex).toBe(6);
    const lines = r.newContent.split('\n');
    expect(lines[5]).toBe('- [ ] #DO_IMMEDIATELY existing');
    expect(lines[6]).toBe('- [ ] #SCHEDULE 🛫 2026-05-14 new task');
  });

  it('creates # Dnes when missing', () => {
    const content = [
      '---',
      'date: 2026-05-14',
      '---',
      '',
      '# Notes',
      'text',
    ].join('\n');
    const r = appendTaskUnderHeading(content, '# Dnes', 'fresh', 'DO_IMMEDIATELY', '2026-05-14');
    expect(r.newContent).toContain('# Dnes');
    expect(r.newContent).toContain('- [ ] #DO_IMMEDIATELY 🛫 2026-05-14 fresh');
  });
});

describe('transformLineInContent', () => {
  it('replaces target line, preserves rest', () => {
    const content = ['# Dnes', '- [ ] #DO_IMMEDIATELY a', '- [ ] #DO_IMMEDIATELY b'].join('\n');
    const out = transformLineInContent(content, 1, (l) =>
      toggleLine(l, '2026-05-14').newLine,
    );
    const lines = out.split('\n');
    expect(lines[0]).toBe('# Dnes');
    expect(lines[1]).toBe('- [x] #DO_IMMEDIATELY a ✅ 2026-05-14');
    expect(lines[2]).toBe('- [ ] #DO_IMMEDIATELY b');
  });
  it('preserves CRLF when present', () => {
    const content = ['- [ ] #DO_IMMEDIATELY a', '- [ ] #DO_IMMEDIATELY b'].join('\r\n');
    const out = transformLineInContent(content, 0, (l) =>
      toggleLine(l, '2026-05-14').newLine,
    );
    expect(out.includes('\r\n')).toBe(true);
  });
});
