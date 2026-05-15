import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { App, EventRef, PaneType } from 'obsidian';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import type { ObsidianTaskRepo } from '../obsidian-adapter/ObsidianTaskRepo.ts';
import { showError } from '../obsidian-adapter/toast.ts';
import type { Priority, Quadrant, Task } from '../core/types.ts';
import { QUADRANTS } from '../core/types.ts';
import {
  extractAllContextTags,
  formatDateISO,
  makeCompareTask,
  matchesFilter,
} from '../core/taskUtils.ts';
import { Matrix } from '../components/Matrix.tsx';
import { FilterBar } from '../components/FilterBar.tsx';
import { DateNav } from '../components/DateNav.tsx';
import { TaskCardOverlay, GRACE_MS } from '../components/TaskCard.tsx';
import type EisenhowerMatrixPlugin from '../../main.ts';

type Props = {
  app: App;
  repo: ObsidianTaskRepo;
  plugin: EisenhowerMatrixPlugin;
};

function taskKey(sourceFile: string, lineIndex: number): string {
  return `${sourceFile}:${lineIndex}`;
}

/**
 * Z events všech typů (Mouse/Pointer/Touch) vytáhne clientX/Y. Default dnd-kit
 * to neumí univerzálně, takže si to spočítáme sami.
 */
function getEventCoordinates(event: Event): { x: number; y: number } | null {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }
  // Fallback pro PointerEvent a jiné (mají clientX/Y)
  if ('clientX' in event && 'clientY' in event) {
    const ev = event as { clientX: number; clientY: number };
    return { x: ev.clientX, y: ev.clientY };
  }
  return null;
}

/**
 * Modifier pro DragOverlay — drží STŘED overlay přímo pod kurzorem,
 * bez ohledu na to, kde uživatel kliknul na originální kartu.
 *
 * Standardní chování dnd-kit: top-left overlay = top-left source. Pokud
 * uživatel kliknul na levý horní roh karty, vypadalo to OK; pokud kliknul
 * na střed, vypadalo to že overlay „odskočil" doprava dolů.
 */
const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const coords = getEventCoordinates(activatorEvent);
  if (!coords) return transform;
  const offsetX = coords.x - draggingNodeRect.left;
  const offsetY = coords.y - draggingNodeRect.top;
  return {
    ...transform,
    x: transform.x + offsetX - draggingNodeRect.width / 2,
    y: transform.y + offsetY - draggingNodeRect.height / 2,
  };
};

export function MatrixApp({ app, repo, plugin }: Props) {
  const today = useMemo(() => formatDateISO(new Date()), []);
  const [date, setDate] = useState<string>(today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayFileExists, setTodayFileExists] = useState(false);
  const [scannedFiles, setScannedFiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingDates, setExistingDates] = useState<Set<string>>(() => new Set());

  // Settings (persisted)
  const [selectedTags, setSelectedTags] = useState<string[]>(plugin.settings.selectedTags);
  const [collapsed, setCollapsed] = useState<Record<Quadrant, boolean>>(
    plugin.settings.collapsedQuadrants,
  );
  const [showCompleted, setShowCompleted] = useState<boolean>(plugin.settings.showCompleted);
  const [headerCollapsed, setHeaderCollapsed] = useState<boolean>(
    plugin.settings.headerCollapsed,
  );
  const [dayChangedBanner, setDayChangedBanner] = useState<string | null>(() => {
    const last = plugin.settings.lastOpenedDate;
    return last && last !== today ? last : null;
  });

  // Grace period: map key (sourceFile:lineIndex) -> expiresAt timestamp
  const [graceMap, setGraceMap] = useState<Map<string, number>>(() => new Map());
  const [, setTick] = useState(0);

  // Update last opened
  useEffect(() => {
    if (dayChangedBanner === null) {
      plugin.settings.lastOpenedDate = today;
      void plugin.saveSettings();
    }
  }, [today, dayChangedBanner, plugin]);

  useEffect(() => {
    plugin.settings.selectedTags = selectedTags;
    void plugin.saveSettings();
  }, [selectedTags, plugin]);

  useEffect(() => {
    plugin.settings.collapsedQuadrants = collapsed;
    void plugin.saveSettings();
  }, [collapsed, plugin]);

  useEffect(() => {
    plugin.settings.showCompleted = showCompleted;
    void plugin.saveSettings();
  }, [showCompleted, plugin]);

  useEffect(() => {
    plugin.settings.headerCollapsed = headerCollapsed;
    void plugin.saveSettings();
  }, [headerCollapsed, plugin]);

  // === Data fetching ===
  const refetchTimerRef = useRef<number | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await repo.getMatrixTasks(date);
      setTasks(result.tasks);
      setTodayFileExists(result.todayFileExists);
      setScannedFiles(result.scannedFiles);
      setExistingDates(repo.getExistingDailyDates());
      setError(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, [repo, date]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = window.setTimeout(() => {
      void refetch();
      refetchTimerRef.current = null;
    }, 200);
  }, [refetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Live sync
  useEffect(() => {
    const refs: EventRef[] = [];
    refs.push(app.vault.on('modify', scheduleRefetch));
    refs.push(app.vault.on('create', scheduleRefetch));
    refs.push(app.vault.on('delete', scheduleRefetch));
    refs.push(app.vault.on('rename', scheduleRefetch));
    return () => {
      for (const ref of refs) app.vault.offref(ref);
      if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    };
  }, [app, scheduleRefetch]);

  // Grace period interval — clean expired keys + re-render
  useEffect(() => {
    if (graceMap.size === 0) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      let mutated = false;
      setGraceMap((prev) => {
        const next = new Map(prev);
        for (const [k, exp] of next) {
          if (exp <= now) {
            next.delete(k);
            mutated = true;
          }
        }
        return mutated ? next : prev;
      });
      setTick((t) => t + 1);
    }, 250);
    return () => window.clearInterval(interval);
  }, [graceMap.size]);

  // === Local optimistic mutations ===
  const applyLocalToggle = useCallback(
    (sourceFile: string, lineIndex: number, nextChecked: boolean) => {
      const key = taskKey(sourceFile, lineIndex);
      setTasks((prev) =>
        prev.map((t) =>
          t.sourceFile === sourceFile && t.lineIndex === lineIndex
            ? {
                ...t,
                checked: nextChecked,
                doneDate: nextChecked ? today : undefined,
              }
            : t,
        ),
      );
      if (nextChecked) {
        setGraceMap((prev) => {
          const next = new Map(prev);
          next.set(key, Date.now() + GRACE_MS);
          return next;
        });
      } else {
        setGraceMap((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [today],
  );

  // === Write callbacks ===
  const handleToggle = useCallback(
    async (task: Task) => {
      const nextChecked = !task.checked;
      applyLocalToggle(task.sourceFile, task.lineIndex, nextChecked);
      try {
        await repo.toggleTask(task.sourceFile, task.lineIndex, today);
      } catch (e) {
        applyLocalToggle(task.sourceFile, task.lineIndex, task.checked);
        showError(`Toggle selhal: ${String((e as Error).message ?? e)}`);
      }
    },
    [repo, today, applyLocalToggle],
  );

  const handleSetDueDate = useCallback(
    async (task: Task, newDueDate: string | null) => {
      try {
        await repo.setDueDate(task.sourceFile, task.lineIndex, newDueDate);
      } catch (e) {
        showError(`Změna termínu selhala: ${String((e as Error).message ?? e)}`);
      }
    },
    [repo],
  );

  const handleUpdate = useCallback(
    async (
      task: Task,
      text: string,
      contextTags: string[],
      options: { dueDate: string | null; priority: Priority | null },
    ) => {
      try {
        await repo.updateTask(task.sourceFile, task.lineIndex, text, contextTags, options);
      } catch (e) {
        showError(`Uložení selhalo: ${String((e as Error).message ?? e)}`);
        throw e;
      }
    },
    [repo],
  );

  const handleAdd = useCallback(
    async (input: {
      text: string;
      quadrant: Quadrant;
      dueDate: string | null;
      priority: Priority | null;
    }) => {
      try {
        await repo.addTask(date, input.text, input.quadrant, input.dueDate, input.priority);
      } catch (e) {
        showError(`Přidání selhalo: ${String((e as Error).message ?? e)}`);
        throw e;
      }
    },
    [repo, date],
  );

  const handleOpenSource = useCallback(
    (task: Task, mode: PaneType | boolean = false) => {
      const file = app.vault.getFileByPath(task.sourceFile);
      if (!file) {
        showError(`Soubor nenalezen: ${task.sourceFile}`);
        return;
      }
      const leaf = app.workspace.getLeaf(mode);
      void leaf.openFile(file, {
        active: true,
        eState: { line: task.lineIndex },
      });
    },
    [app],
  );

  // === Derived state ===
  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!matchesFilter(t, selectedTags)) return false;
        if (showCompleted) return true;
        if (!t.checked) return true;
        return graceMap.has(taskKey(t.sourceFile, t.lineIndex));
      }),
    [tasks, selectedTags, showCompleted, graceMap],
  );

  const sortedVisibleTasks = useMemo(
    () => [...visibleTasks].sort(makeCompareTask(today)),
    [visibleTasks, today],
  );

  const availableTags = useMemo(
    () => extractAllContextTags(tasks.filter((t) => showCompleted || !t.checked)),
    [tasks, showCompleted],
  );

  const totalUnfiltered = useMemo(
    () => tasks.filter((t) => showCompleted || !t.checked).length,
    [tasks, showCompleted],
  );

  // === UI handlers ===
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag],
    );
  }, []);

  const clearTags = useCallback(() => setSelectedTags([]), []);

  const toggleQuadrantCollapsed = useCallback((q: Quadrant) => {
    setCollapsed((prev) => ({ ...prev, [q]: !prev[q] }));
  }, []);

  const anyCollapsed = Object.values(collapsed).some(Boolean);

  const collapseAll = useCallback(() => {
    setCollapsed(
      Object.fromEntries(QUADRANTS.map((q) => [q, true])) as Record<Quadrant, boolean>,
    );
  }, []);

  const expandAll = useCallback(() => {
    setCollapsed(
      Object.fromEntries(QUADRANTS.map((q) => [q, false])) as Record<Quadrant, boolean>,
    );
  }, []);

  const acknowledgeDayChange = useCallback(
    (jumpToToday: boolean) => {
      if (jumpToToday) setDate(today);
      plugin.settings.lastOpenedDate = today;
      void plugin.saveSettings();
      setDayChangedBanner(null);
    },
    [today, plugin],
  );

  // === Drag & drop ===
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);
      const t = tasks.find((x) => taskKey(x.sourceFile, x.lineIndex) === id);
      setActiveTask(t ?? null);
    },
    [tasks],
  );

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveTask(null);
      if (!e.over) return;

      const draggedId = String(e.active.id);
      const overId = String(e.over.id);
      if (draggedId === overId) return;

      const dragged = tasks.find((t) => taskKey(t.sourceFile, t.lineIndex) === draggedId);
      if (!dragged) return;

      // overId je vždy Quadrant kind (karty nejsou drop targety — useDraggable only)
      if (!QUADRANTS.includes(overId as Quadrant)) return;

      const targetQuadrant = overId as Quadrant;
      if (dragged.quadrant === targetQuadrant) return;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          taskKey(t.sourceFile, t.lineIndex) === draggedId
            ? { ...t, quadrant: targetQuadrant }
            : t,
        ),
      );

      try {
        await repo.moveTask(dragged.sourceFile, dragged.lineIndex, targetQuadrant);
      } catch (err) {
        // rollback
        setTasks((prev) =>
          prev.map((t) =>
            taskKey(t.sourceFile, t.lineIndex) === draggedId ? dragged : t,
          ),
        );
        showError(`Přesun selhal: ${String((err as Error).message ?? err)}`);
      }
    },
    [tasks, repo],
  );

  const isPastOrFuture = date !== today;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="em-app">
        {headerCollapsed ? (
          <div className="em-app-header em-app-header-compact">
            <span className="em-compact-info">
              ⚡ Eisenhower Matrix · {tasks.length} tasků
            </span>
            <button
              type="button"
              onClick={() => setHeaderCollapsed(false)}
              className="em-header-collapse-btn"
              title="Rozbalit hlavičku"
              aria-label="Rozbalit hlavičku"
            >
              ▼
            </button>
          </div>
        ) : (
        <div className="em-app-header">
        <header className="em-header">
          <div className="em-header-left">
            <h2 className="em-title">Eisenhower Matrix</h2>
            <DateNav
              date={date}
              today={today}
              existingDates={existingDates}
              onChange={setDate}
            />
          </div>
          <div className="em-header-right">
            <button
              type="button"
              onClick={anyCollapsed ? expandAll : collapseAll}
              className="em-btn-link"
            >
              {anyCollapsed ? 'Rozbalit vše' : 'Sbalit vše'}
            </button>
            <label className="em-toggle">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              <span>Hotové</span>
            </label>
            <button
              type="button"
              onClick={() => setHeaderCollapsed(true)}
              className="em-header-collapse-btn"
              title="Sbalit celou hlavičku (uvolní místo)"
              aria-label="Sbalit hlavičku"
            >
              ▲
            </button>
          </div>
        </header>

        <p className="em-subtitle">
          {formatCzechDate(date)}
          {isPastOrFuture && <span className="em-warn"> (ne dnešek)</span>}
          {loading && <span className="em-loading"> · načítám…</span>}
          {!loading && (
            <span className="em-stats">
              {' '}· {tasks.length} tasků · skenováno {scannedFiles} souborů
            </span>
          )}
        </p>

        {dayChangedBanner && (
          <div className="em-banner em-banner-warn">
            <span>
              Od posledního otevření (<strong>{dayChangedBanner}</strong>) je nový den.
              Přepnout na dnešek (<strong>{today}</strong>)?
            </span>
            <div className="em-banner-actions">
              <button
                type="button"
                onClick={() => acknowledgeDayChange(true)}
                className="em-btn-primary"
              >
                Přepnout
              </button>
              <button
                type="button"
                onClick={() => acknowledgeDayChange(false)}
                className="em-btn-secondary"
              >
                Zůstat
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="em-error" role="alert">
            Chyba: {error}
          </div>
        )}

        {!todayFileExists && !loading && (
          <div className="em-info">
            Pro {date} zatím neexistuje daily note. Přidej první task přes <code>+</code>{' '}
            v libovolném kvadrantu — soubor se vytvoří automaticky.
          </div>
        )}

        <FilterBar
          availableTags={availableTags}
          selectedTags={selectedTags}
          onToggle={toggleTag}
          onClear={clearTags}
          totalCount={totalUnfiltered}
          filteredCount={sortedVisibleTasks.length}
        />
        </div>
        )}

        <div className="em-app-body">
        <Matrix
          tasks={sortedVisibleTasks}
          today={today}
          collapsed={collapsed}
          graceMap={graceMap}
          activeTaskId={
            activeTask ? taskKey(activeTask.sourceFile, activeTask.lineIndex) : null
          }
          onToggleCollapsed={toggleQuadrantCollapsed}
          onToggleTask={handleToggle}
          onSetDueDate={handleSetDueDate}
          onUpdateTask={handleUpdate}
          onAddTask={handleAdd}
          onOpenSource={handleOpenSource}
        />
        </div>
      </div>
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function formatCzechDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const months = [
    'ledna', 'února', 'března', 'dubna', 'května', 'června',
    'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
  ];
  return `${days[date.getDay()]} ${d}. ${months[m - 1]} ${y}`;
}
