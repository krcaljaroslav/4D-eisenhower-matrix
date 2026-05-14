import { useMemo } from 'react';
import type { PaneType } from 'obsidian';
import type { Priority, Task, Quadrant as QuadrantKind } from '../core/types.ts';
import { QUADRANTS } from '../core/types.ts';
import { Quadrant } from './Quadrant.tsx';

type Props = {
  tasks: Task[];
  today: string;
  collapsed: Record<QuadrantKind, boolean>;
  graceMap: Map<string, number>;
  activeTaskId: string | null;
  onToggleCollapsed: (q: QuadrantKind) => void;
  onToggleTask: (task: Task) => void;
  onSetDueDate: (task: Task, newDueDate: string | null) => Promise<void>;
  onUpdateTask: (
    task: Task,
    text: string,
    contextTags: string[],
    options: { dueDate: string | null; priority: Priority | null },
  ) => Promise<void>;
  onAddTask: (input: {
    text: string;
    quadrant: QuadrantKind;
    dueDate: string | null;
    priority: Priority | null;
  }) => Promise<void>;
  onOpenSource: (task: Task, mode?: PaneType | boolean) => void;
};

export function Matrix(props: Props) {
  const tasksByQuadrant = useMemo(() => {
    const map: Record<QuadrantKind, Task[]> = {
      DO: [],
      DECIDE: [],
      DELEGATE: [],
      DELETE: [],
      OPEN: [],
    };
    for (const t of props.tasks) {
      map[t.quadrant].push(t);
    }
    return map;
  }, [props.tasks]);

  const renderQuadrant = (q: QuadrantKind) => (
    <Quadrant
      key={q}
      kind={q}
      tasks={tasksByQuadrant[q]}
      today={props.today}
      collapsed={props.collapsed[q]}
      graceMap={props.graceMap}
      activeTaskId={props.activeTaskId}
      onToggleCollapsed={() => props.onToggleCollapsed(q)}
      onToggleTask={props.onToggleTask}
      onSetDueDate={props.onSetDueDate}
      onUpdateTask={props.onUpdateTask}
      onAddTask={props.onAddTask}
      onOpenSource={props.onOpenSource}
    />
  );

  return (
    <div className="em-matrix">
      <div className="em-matrix-grid">
        {QUADRANTS.filter((q) => q !== 'OPEN').map(renderQuadrant)}
      </div>
      <div className="em-matrix-open">{renderQuadrant('OPEN')}</div>
    </div>
  );
}
