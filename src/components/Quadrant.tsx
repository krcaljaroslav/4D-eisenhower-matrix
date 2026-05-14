import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { PaneType } from 'obsidian';
import type { Priority, Quadrant as QuadrantKind, Task } from '../core/types.ts';
import { QUADRANT_META } from '../core/types.ts';
import { TaskCard } from './TaskCard.tsx';
import { AddTaskInput } from './AddTaskInput.tsx';

type Props = {
  kind: QuadrantKind;
  tasks: Task[];
  today: string;
  collapsed: boolean;
  activeTaskId: string | null;
  onToggleCollapsed: () => void;
  graceMap: Map<string, number>;
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

export function Quadrant({
  kind,
  tasks,
  today,
  collapsed,
  activeTaskId,
  onToggleCollapsed,
  graceMap,
  onToggleTask,
  onSetDueDate,
  onUpdateTask,
  onAddTask,
  onOpenSource,
}: Props) {
  const meta = QUADRANT_META[kind];
  const [adding, setAdding] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: kind });

  const openAdder = () => {
    setAdding(true);
    if (collapsed) onToggleCollapsed();
  };

  return (
    <section
      ref={setNodeRef}
      className={`em-quadrant em-quadrant-${kind.toLowerCase()} ${
        isOver ? 'em-quadrant-over' : ''
      }`}
      aria-label={meta.label}
    >
      <header className="em-quadrant-header">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="em-quadrant-collapse"
          aria-expanded={!collapsed}
        >
          <span className="em-collapse-icon">{collapsed ? '▶' : '▼'}</span>
          <div className="em-quadrant-title">
            <h3>{meta.label}</h3>
            <p>{meta.subtitle}</p>
          </div>
        </button>
        <div className="em-quadrant-actions">
          <button
            type="button"
            onClick={openAdder}
            className="em-quadrant-add"
            title="Přidat task"
            aria-label={`Přidat task do ${meta.label}`}
          >
            +
          </button>
          <span className="em-quadrant-count">{tasks.length}</span>
        </div>
      </header>

      {!collapsed && (
        <div className="em-quadrant-body">
          {adding && (
            <AddTaskInput
              quadrant={kind}
              onSubmit={async (input) => {
                await onAddTask(input);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          )}
          {tasks.length === 0 && !adding ? (
            <p className="em-empty">Žádné tasky</p>
          ) : (
            <ul className="em-task-list">
              {tasks.map((t) => {
                const key = `${t.sourceFile}:${t.lineIndex}`;
                return (
                  <TaskCard
                    key={key}
                    task={t}
                    today={today}
                    graceExpiresAt={graceMap.get(key)}
                    isActiveDrag={activeTaskId === key}
                    onToggle={() => onToggleTask(t)}
                    onSetDueDate={(d) => onSetDueDate(t, d)}
                    onUpdateTask={(text, tags, opts) => onUpdateTask(t, text, tags, opts)}
                    onOpenSource={(mode) => onOpenSource(t, mode)}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
