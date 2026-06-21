/**
 * Sort + filter utility — sdíleno s `Eisenhower-matrix/app/src/utils/taskUtils.ts`.
 * Drž sync ručně.
 */

import type { Priority, Task } from './types.ts';

const PRIORITY_RANK: Record<Priority | 'none', number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
  none: 5,
};

function priorityRank(p?: Priority): number {
  return p ? PRIORITY_RANK[p] : PRIORITY_RANK.none;
}

/**
 * Comparator pro řazení tasků uvnitř kvadrantu:
 *   1. Overdue (dueDate < today)
 *   2. Priorita desc (🔺 → ⏫ → 🔼 → 🔽 → ⏬ → bez)
 *   3. Due date asc (s dueDate před bez)
 *   4. Text alfabeticky (cs locale)
 */
export function makeCompareTask(today: string): (a: Task, b: Task) => number {
  return (a, b) => {
    const aOverdue = isOverdue(a, today);
    const bOverdue = isOverdue(b, today);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;

    if (a.dueDate && b.dueDate) {
      const cmp = a.dueDate.localeCompare(b.dueDate);
      if (cmp !== 0) return cmp;
    } else if (a.dueDate) {
      return -1;
    } else if (b.dueDate) {
      return 1;
    }

    return a.text.localeCompare(b.text, 'cs');
  };
}

export function isOverdue(task: Task, today: string): boolean {
  return !!task.dueDate && task.dueDate < today;
}

export const UNTAGGED_FILTER = '__untagged__';

export function extractAllContextTags(tasks: Task[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  let untagged = 0;
  for (const t of tasks) {
    if (t.contextTags.length === 0) untagged++;
    for (const tag of t.contextTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const entries = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'cs', { sensitivity: 'base' }));
  // UNTAGGED_FILTER ("Ostatní") vždy na konci, nezávisle na abecedě.
  if (untagged > 0) {
    entries.push({ tag: UNTAGGED_FILTER, count: untagged });
  }
  return entries;
}

export function matchesFilter(task: Task, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  return selectedTags.some((sel) => {
    if (sel === UNTAGGED_FILTER) return task.contextTags.length === 0;
    return task.contextTags.some((t) => t.toLowerCase() === sel.toLowerCase());
  });
}

// ============================================================
// Rychlý filtr podle due date
// ============================================================

export type DueFilter = 'none' | 'today' | 'week' | 'selected';

/** Vrátí ISO datum posunuté o `days` (lokální čas, bez UTC off-by-one). */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return formatDateISO(new Date(y, m - 1, d + days));
}

/**
 * Due-date quick filtr:
 *   'today'    = overdue + due dnes
 *   'week'     = overdue + due v rozmezí dnes .. dnes+7
 *   'selected' = due přesně na datum vybrané v horní liště (`selectedDate`),
 *                bez overdue — čistě tasky toho jednoho dne
 * Tasky bez due date při aktivním filtru nikdy nematchují.
 */
export function matchesDueFilter(
  task: Task,
  dueFilter: DueFilter,
  today: string,
  selectedDate: string,
): boolean {
  if (dueFilter === 'none') return true;
  if (!task.dueDate) return false;
  if (dueFilter === 'selected') return task.dueDate === selectedDate;
  if (task.dueDate < today) return true; // overdue platí pro 'today' i 'week'
  if (dueFilter === 'today') return task.dueDate === today;
  return task.dueDate <= addDaysISO(today, 7); // 'week': dnes .. dnes+7
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
