import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Menu, Platform, type PaneType } from 'obsidian';
import type { Priority, Quadrant, Task } from '../core/types.ts';
import {
  PRIORITY_META,
  QUADRANTS,
  QUADRANT_META,
  TASK_STATUSES,
} from '../core/types.ts';
import { isOverdue } from '../core/taskUtils.ts';
import { DueDatePicker } from './DueDatePicker.tsx';
import { PriorityPicker } from './PriorityPicker.tsx';
import { renderInlineMarkdown } from './inlineMarkdown.tsx';

export const GRACE_MS = 3000;

type Props = {
  task: Task;
  today: string;
  graceExpiresAt?: number;
  isActiveDrag: boolean;
  compact: boolean;
  onToggle: () => void;
  onSetStatus: (newStatus: string) => Promise<void>;
  onSetDueDate: (newDueDate: string | null) => Promise<void>;
  onUpdateTask: (
    text: string,
    contextTags: string[],
    options: { dueDate: string | null; priority: Priority | null },
  ) => Promise<void>;
  onOpenSource: (mode?: PaneType | boolean) => void;
  onMoveQuadrant: (target: Quadrant) => void;
  createTagSuggest: (inputEl: HTMLInputElement) => void;
};

export function TaskCard({
  task,
  today,
  graceExpiresAt,
  isActiveDrag,
  compact,
  onToggle,
  onSetStatus,
  onSetDueDate,
  onUpdateTask,
  onOpenSource,
  onMoveQuadrant,
  createTagSuggest,
}: Props) {
  const overdue = isOverdue(task, today);
  const [editing, setEditing] = useState(false);

  const draggableId = `${task.sourceFile}:${task.lineIndex}`;
  // Drag jen na desktopu. Na mobilu je touch-drag v Obsidian webview
  // nespolehlivý (long-press hijackne OS) — místo toho přesun přes
  // context menu „Přesunout do…".
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: draggableId,
    disabled: editing || Platform.isMobile,
  });

  const now = Date.now();
  const inGrace = task.checked && graceExpiresAt !== undefined && graceExpiresAt > now;
  const graceRemaining = inGrace ? Math.max(0, graceExpiresAt! - now) : 0;
  const gracePct = inGrace ? (graceRemaining / GRACE_MS) * 100 : 0;

  const enterEdit = () => {
    if (editing) return;
    setEditing(true);
  };

  const buildMenu = (): Menu => {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle('Edit').setIcon('pencil').onClick(enterEdit),
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle('Open file')
        .setIcon('file-text')
        .onClick(() => onOpenSource(false)),
    );
    menu.addItem((item) =>
      item
        .setTitle('Open in new tab')
        .setIcon('file-plus')
        .onClick(() => onOpenSource('tab')),
    );
    menu.addItem((item) =>
      item
        .setTitle('Open in new pane to the right')
        .setIcon('separator-vertical')
        .onClick(() => onOpenSource('split')),
    );
    menu.addItem((item) =>
      item
        .setTitle('Open in new window')
        .setIcon('picture-in-picture-2')
        .onClick(() => onOpenSource('window')),
    );
    // Přesun do jiného kvadrantu — hlavní cesta pro mobil (drag tam nefunguje
    // spolehlivě). Vynechá aktuální kvadrant tasku.
    menu.addSeparator();
    for (const q of QUADRANTS) {
      if (q === task.quadrant) continue;
      menu.addItem((item) =>
        item
          .setTitle(`Move to ${QUADRANT_META[q].label}`)
          .setIcon('arrow-right')
          .onClick(() => onMoveQuadrant(q)),
      );
    }
    // Status (6 Basic stavů) — sekce úmyslně až dole, ať nepřebírá pozornost
    // od běžnějších voleb (Edit / Open / Move). Aktuální je zatržený.
    menu.addSeparator();
    for (const s of TASK_STATUSES) {
      const isCurrent =
        s.char === task.status ||
        (s.char === 'x' && task.status.toLowerCase() === 'x');
      menu.addItem((item) =>
        item
          .setTitle(`Mark as ${s.label}`)
          .setIcon(s.icon)
          .setChecked(isCurrent)
          .onClick(() => {
            if (!isCurrent) void onSetStatus(s.char);
          }),
      );
    }
    return menu;
  };

  /**
   * Kontextové menu — desktop: pravý klik · mobil: long-press i double-tap.
   */
  const showContextMenu = (e: React.MouseEvent) => {
    if (editing) return;
    e.preventDefault();
    e.stopPropagation();
    buildMenu().showAtMouseEvent(e.nativeEvent);
  };

  /**
   * Double-tap: desktop → rovnou edit (rychlá cesta) · mobil → kontextové menu.
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (editing) return;
    if (Platform.isMobile) {
      e.preventDefault();
      e.stopPropagation();
      buildMenu().showAtMouseEvent(e.nativeEvent);
    } else {
      enterEdit();
    }
  };

  const taskText = task.text ? (
    renderInlineMarkdown(task.text)
  ) : (
    <em className="em-empty-text">(empty text)</em>
  );

  // Statusový knoflík: kreslí stav přes CSS (data-task=" "/"/"/"x"/"-"/">"/"<"…).
  // Klik = klasický toggle ([ ] ↔ [x]). Pro ostatní stavy ('/', '>', '<', '-')
  // slouží kontextové menu „Mark as …". Z neznámého stavu jdeme na [x].
  const statusForRender = task.status === '' ? ' ' : task.status;
  const checkbox = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        buildMenu().showAtMouseEvent(e.nativeEvent);
      }}
      className="em-task-checkbox em-task-status"
      data-task={statusForRender}
      aria-label={task.checked ? 'Mark as not done (undo)' : 'Mark as done'}
      title="Click to toggle done · right-click for all states"
    />
  );

  const priorityBadge = task.priority ? (
    <span
      className="em-badge"
      style={{ color: PRIORITY_META[task.priority].tone }}
      title={`Priority: ${PRIORITY_META[task.priority].label}`}
    >
      {PRIORITY_META[task.priority].emoji} {PRIORITY_META[task.priority].label}
    </span>
  ) : null;

  const dueDatePicker = (
    <DueDatePicker
      currentDueDate={task.dueDate}
      onChange={onSetDueDate}
      variant={task.dueDate ? 'badge' : 'add'}
      overdue={overdue}
    />
  );

  return (
    <li
      ref={setNodeRef}
      {...(editing ? {} : attributes)}
      {...(editing ? {} : listeners)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={showContextMenu}
      className={`em-task ${overdue ? 'em-task-overdue' : ''} ${
        inGrace ? 'em-task-grace' : ''
      } ${editing ? 'em-task-editing' : ''} ${task.checked && !editing ? 'em-task-checked' : ''} ${
        task.status === '-' && !editing ? 'em-task-canceled' : ''
      } ${isActiveDrag && !Platform.isMobile ? 'em-task-active-drag' : ''}`}
      title={
        editing
          ? undefined
          : Platform.isMobile
            ? 'Long-press or double-tap for menu'
            : 'Double-click to edit · right-click for menu'
      }
    >
      {editing ? (
        <EditForm
          task={task}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onUpdate={onUpdateTask}
          createTagSuggest={createTagSuggest}
        />
      ) : compact ? (
        <div className="em-task-row">
          {checkbox}
          <div className="em-task-body em-task-body-compact">
            <p className="em-task-text em-task-text-compact">{taskText}</p>
            <div className="em-task-badges">
              {priorityBadge}
              {dueDatePicker}
            </div>
          </div>
        </div>
      ) : (
        <div className="em-task-row">
          {checkbox}
          <div className="em-task-body">
            <p className="em-task-text">{taskText}</p>
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
              {priorityBadge}
              {dueDatePicker}
              {task.startDate && <span className="em-badge">🛫 {task.startDate}</span>}
              {task.doneDate && <span className="em-badge">✅ {task.doneDate}</span>}
            </div>
            {inGrace && (
              <p className="em-task-grace-hint">
                ↩ click again to undo · {Math.ceil(graceRemaining / 1000)} s
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
  createTagSuggest: (inputEl: HTMLInputElement) => void;
};

function EditForm({ task, onCancel, onSaved, onUpdate, createTagSuggest }: EditFormProps) {
  const [text, setText] = useState(task.text);
  const [tagsRaw, setTagsRaw] = useState(task.contextTags.join(' '));
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [priority, setPriority] = useState<Priority | null>(task.priority ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    if (tagsRef.current) createTagSuggest(tagsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (pending) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Text cannot be empty');
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
    if (e.key === 'Enter') {
      // Když je otevřený tag-autocomplete popup, nech Enter jemu — jinak
      // by se uložil stav PŘED výběrem návrhu (výběr tagu by se ztratil).
      const doc = (e.currentTarget as HTMLElement).ownerDocument;
      if (doc.querySelector('.suggestion-container')) {
        return;
      }
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
      <input
        ref={textRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={pending}
        className="em-edit-text"
        placeholder="Task text"
      />
      <input
        ref={tagsRef}
        type="text"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={pending}
        placeholder="#tag1 #tag2 (autocomplete · space-separated · # added automatically)"
        className="em-edit-tags"
      />
      <div className="em-edit-controls">
        <button
          type="button"
          onClick={openDatePicker}
          disabled={pending}
          className={`em-badge ${dueDate ? 'em-badge-clickable' : 'em-badge-add'}`}
          title="Set due date"
        >
          📅 {dueDate || 'no date'}
        </button>
        {dueDate && (
          <button
            type="button"
            onClick={() => setDueDate('')}
            disabled={pending}
            className="em-badge-clear"
            title="Remove due date"
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
        <span className="em-edit-hint">Enter = save · Esc = cancel</span>
        <div className="em-edit-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="em-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !text.trim()}
            className="em-btn-primary-accent"
          >
            {pending ? '…' : 'Save'}
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
      <p className="em-task-text">{renderInlineMarkdown(task.text)}</p>
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
