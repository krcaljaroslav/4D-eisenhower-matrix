import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Platform } from 'obsidian';
import { useDraggable } from '@dnd-kit/core';
import { TaskCard, QuadrantActionsContext, TouchDragContext } from '../src/components/TaskCard.tsx';
import { parseTaskLine } from '../src/core/parser.ts';
import { applyQuadrantRules, DEFAULT_QUADRANT_RULES } from '../src/core/quadrantRules.ts';
import type { Task } from '../src/core/types.ts';

vi.mock('obsidian', () => ({ Platform: { isMobile: false }, Keymap: {}, Menu: class {}, setIcon: vi.fn() }));
vi.mock('../src/components/TaskSuggest.ts', () => ({ TaskSuggest: class {} }));
vi.mock('@dnd-kit/core', () => ({ useDraggable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: () => undefined })) }));

function render(raw: string, rules: boolean, compact: boolean, touchDrag = false) {
  const task: Task = { ...parseTaskLine(raw, 0)!, sourceFile: 'a.md', isFromDnes: false, isBlocked: false,
    blockedByTasks: [], blocksTasks: [], missingBlockers: [], hasCircularDependency: false };
  const [assigned] = applyQuadrantRules([task], rules ? 'rules' : 'tags', DEFAULT_QUADRANT_RULES, '2026-10-22');
  return renderToStaticMarkup(
    <TouchDragContext.Provider value={touchDrag}>
    <QuadrantActionsContext.Provider value={{ rules, pin: vi.fn(), automatic: vi.fn() }}>
      <TaskCard task={assigned} today="2026-10-22" isActiveDrag={false} compact={compact}
        onToggle={vi.fn()} onSetStatus={vi.fn()} onSetDueDate={vi.fn()} onUpdateTask={vi.fn()}
        onOpenSource={vi.fn()} onOpenLink={vi.fn()} onMoveQuadrant={vi.fn()} createTagSuggest={vi.fn()} />
    </QuadrantActionsContext.Provider>
    </TouchDragContext.Provider>,
  );
}

describe('automatic quadrant badge', () => {
  it.each([true, false])('shows rule tooltip in compact=%s and hides it for explicit tags', (compact) => {
    expect(render('- [ ] ⏫ Work', true, compact)).toContain('title="Assigned by rule: DECIDE">auto</span>');
    expect(render('- [ ] #DECIDE ⏫ Work', true, compact)).not.toContain('>auto</span>');
    expect(render('- [ ] #OPEN ⏫ Work', true, compact)).not.toContain('>auto</span>');
    expect(render('- [ ] ⏫ Work', false, compact)).not.toContain('>auto</span>');
  });
  it('enables mobile drag and scrolling styles only with the experiment', () => {
    Platform.isMobile = true;
    const html = render('- [ ] Work', false, false, true);
    expect(useDraggable).toHaveBeenLastCalledWith({ id: 'a.md:0', disabled: false });
    expect(html).toContain('touch-action:manipulation');
    expect(render('- [ ] Work', false, false)).not.toContain('touch-action:');
    Platform.isMobile = false;
    expect(render('- [ ] Work', false, false, true)).not.toContain('touch-action:');
    expect(useDraggable).toHaveBeenLastCalledWith({ id: 'a.md:0', disabled: false });
  });
  it('keeps mobile drag disabled and desktop drag enabled', () => {
    for (const mobile of [true, false]) {
      Platform.isMobile = mobile;
      render('- [ ] Work', false, false);
      expect(useDraggable).toHaveBeenLastCalledWith({ id: 'a.md:0', disabled: mobile });
    }
  });
});
