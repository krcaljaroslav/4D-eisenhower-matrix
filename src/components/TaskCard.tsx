import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Priority, Task } from '../core/types.ts';
import { PRIORITY_META } from '../core/types.ts';
import { isOverdue } from '../core/taskUtils.ts';
import { DueDatePicker } from './DueDatePicker.tsx';
import { PriorityPicker } from './PriorityPicker.tsx';

export const GRACE_MS = 3000;

type Props = {
  task: Task;
  today: string;
  graceExpiresAt?: number;
  onToggle: () => void;
  onSetDueDate: (newDueDate: string | null) => Promise<void>;
  onUpdateTask: (
    text: string,
    contextTags: string[],
    options: { dueDate: string | null; priority: Priority | null },
  ) => Promise<void>;
};

export function TaskCard({
  task,
  today,
  graceExpiresAt,
  onToggle,
  onSetDueDate,
  onUpdateTask,
}: Props) {
  const overdue = isOverdue(task, today);
  const [editing, setEditing] = useState(false);

  const draggableId = `${task.sourceFile}:${task.lineIndex}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    disabled: editing,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const now = Date.now();
  const inGrace = task.checked && graceExpiresAt !== undefined && graceExpiresAt > now;
  const graceRemaining = inGrace ? Math.max(0, graceExpiresAt! - now) : 0;
  const gracePct = inGrace ? (graceRemaining / GRACE_MS) * 100 : 0;

  const enterEdit = () => {
    if (editing) return;
    setEditing(true);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(editing ? {} : attributes)}
      {...(editing ? {} : listeners)}
      onDoubleClick={enterEdit}
      className={`em-task ${overdue ? 'em-task-overdue' : ''} ${
        inGrace ? 'em-task-grace' : ''
      } ${editing ? 'em-task-editing' : ''} ${task.checked && !editing ? 'em-task-checked' : ''} ${
        isDragging ? 'em-task-dragging' : ''
      }`}
      title={editing ? undefined : 'Dvojklik pro editaci'}
    >
      {editing ? (
        <EditForm
          task={task}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onUpdate={onUpdateTask}
        />
      ) : (
        <div className="em-task-row">
          <input
            type="checkbox"
            checked={task.checked}
            onChange={onToggle}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="em-task-checkbox"
            aria-label={
              task.checked ? 'Označit jako neudělaný (zpět)' : 'Označit jako hotový'
            }
          />
          <div className="em-task-body">
            <p className="em-task-text">
              {task.text || <em className="em-empty-text">(prázdný text)</em>}
            </p>
            {!task.isFromDnes && (
              <p className="em-task-source" title={task.sourceFile}>
                📁 {shortenPath(task.sourceFile)}
              </p>
            )}
            <div className="em-task-badges">
              {task.contextTags.map((tag) => (
                <span key={tag} className="em-tag">
                  {tag}
                </span>
              ))}
              {task.priority && (
                <span
                  className="em-badge"
                  style={{ color: PRIORITY_META[task.priority].tone }}
                  title={`Priorita: ${PRIORITY_META[task.priority].label}`}
                >
                  {PRIORITY_META[task.priority].emoji} {PRIORITY_META[task.priority].label}
                </span>
              )}
              <DueDatePicker
                currentDueDate={task.dueDate}
                onChange={onSetDueDate}
                variant={task.dueDate ? 'badge' : 'add'}
                overdue={overdue}
              />
              {task.startDate && <span className="em-badge">🛫 {task.startDate}</span>}
              {task.doneDate && <span className="em-badge">✅ {task.doneDate}</span>}
            </div>
            {inGrace && (
              <p className="em-task-grace-hint">
                ↩ klikni znovu pro zpět · {Math.ceil(graceRemaining / 1000)} s
              </p>
            )}
          </div>
        </div>
      )}
      {inGrace && !editing && (
        <div className="em-grace-bar" style={{ width: `${gracePct}%` }} aria-hidden />
      )}
    </li>
  );
}

// ===========================================================
// Edit form (text + tags + due date + priority)
// ===========================================================

type EditFormProps = {
  task: Task;
  onCancel: () => void;
  onSaved: () => void;
  onUpdate: Props['onUpdateTask'];
};

function EditForm({ task, onCancel, onSaved, onUpdate }: EditFormProps) {
  const [text, setText] = useState(task.text);
  const [tagsRaw, setTagsRaw] = useState(task.contextTags.join(' '));
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [priority, setPriority] = useState<Priority | null>(task.priority ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const save = async () => {
    if (pending) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Text nesmí být prázdný');
      return;
    }
    const tagsArray = tagsRaw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setPending(true);
    setError(null);
    try {
      await onUpdate(trimmed, tagsArray, {
        dueDate: dueDate || null,
        priority,
      });
      onSaved();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter (bez Shift) = uložit; Shift+Enter v textarea = nový řádek (default).
    // Funguje stejně v inputu i textarea.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const openDatePicker = () => {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };

  return (
    <div
      className="em-edit-form"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        disabled={pending}
        className="em-edit-text"
        placeholder="Text tasku"
      />
      <input
        type="text"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={pending}
        placeholder="#tag1 #tag2 (mezerou oddělené, # se doplní)"
        className="em-edit-tags"
      />
      <div className="em-edit-controls">
        <button
          type="button"
          onClick={openDatePicker}
          disabled={pending}
          className={`em-badge ${dueDate ? 'em-badge-clickable' : 'em-badge-add'}`}
          title="Nastav due date"
        >
          📅 {dueDate || 'bez termínu'}
        </button>
        {dueDate && (
          <button
            type="button"
            onClick={() => setDueDate('')}
            disabled={pending}
            className="em-badge-clear"
            title="Odstranit termín"
          >
            ×
          </button>
        )}
        <input
          ref={dateRef}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="em-sr-only"
          aria-hidden
          tabIndex={-1}
        />

        <PriorityPicker value={priority} onChange={setPriority} disabled={pending} />
      </div>
      <div className="em-edit-actions">
        <span className="em-edit-hint">
          Enter = uložit · Shift+Enter = nový řádek · Esc = zrušit
        </span>
        <div className="em-edit-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="em-btn-secondary"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !text.trim()}
            className="em-btn-primary-accent"
          >
            {pending ? '…' : 'Uložit'}
          </button>
        </div>
      </div>
      {error && (
        <p className="em-edit-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ===========================================================
// Drag overlay (zobrazena nad ostatními kartami při tažení)
// ===========================================================

export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="em-task em-task-overlay">
      <p className="em-task-text">{task.text}</p>
      {(task.contextTags.length > 0 || task.priority) && (
        <div className="em-task-badges">
          {task.contextTags.map((tag) => (
            <span key={tag} className="em-tag">
              {tag}
            </span>
          ))}
          {task.priority && (
            <span className="em-badge" style={{ color: PRIORITY_META[task.priority].tone }}>
              {PRIORITY_META[task.priority].emoji} {PRIORITY_META[task.priority].label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function shortenPath(rel: string): string {
  const parts = rel.split('/');
  const filename = parts.pop() ?? '';
  const name = filename.replace(/\.md$/i, '');
  const cleaned = parts.map((p) => p.replace(/^\d+_/, ''));
  if (cleaned[0]?.toLowerCase() === 'daily-tasks') {
    return `Daily / ${name}`;
  }
  const short = cleaned.slice(-2).join(' / ');
  return short ? `${short} / ${name}` : name;
}
