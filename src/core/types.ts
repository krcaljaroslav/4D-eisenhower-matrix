/**
 * Core types — sdíleno s `Eisenhower-matrix/app` web verzí.
 * Drž sync ručně. Při změně v jedné kopii uprav i druhou.
 */

export type Quadrant =
  | 'DO_IMMEDIATELY'
  | 'DO_REDUCED'
  | 'DELEGATE_PRIORITY'
  | 'DELEGATE'
  | 'SCHEDULE'
  | 'DEFER'
  | 'OPEN';

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export type Task = {
  lineIndex: number;
  raw: string;
  /**
   * Checkbox status — jeden znak mezi hranatými závorkami.
   * Plugin rozumí 6 Basic stavům (`TASK_STATUSES`), ostatní znaky se
   * vykreslí jako "to-do" a při kliknutí přejdou na `x`.
   */
  status: string;
  /** Derived: status === 'x' / 'X' (zachované kvůli existujícímu kódu). */
  checked: boolean;
  text: string;
  quadrant: Quadrant;
  contextTags: string[];
  dueDate?: string;
  startDate?: string;
  doneDate?: string;
  priority?: Priority;
  id?: string;
  blockedBy: string[];
  trailingTokens: string[];
  /** Odvozené vazby doplněné repository nad celou načtenou množinou úkolů. */
  isBlocked: boolean;
  blockedByTasks: Task[];
  blocksTasks: Task[];
  missingBlockers: string[];
  hasCircularDependency: boolean;
  sourceFile: string;
  isFromDnes: boolean;
};

/**
 * 6 Basic checkbox stavů ve stylu „Things" / Alternate Checkboxes.
 * `done` a `canceled` jsou "closed" — `showCompleted` přepínač je skrývá.
 */
export const TASK_STATUSES: {
  char: string;
  label: string;
  icon: string;
  closed?: boolean;
}[] = [
  // Záměrně hranaté Lucide ikony pro to-do / incomplete / done — vizuálně
  // odpovídají Things theme. canceled / forwarded / scheduling jsou
  // záměrně bez rámečku (jen dash / triangle / calendar) — taky Things.
  { char: ' ', label: 'To-do', icon: 'square' },
  { char: '/', label: 'In progress', icon: 'em-square-half' },
  { char: 'x', label: 'Done', icon: 'square-check-big', closed: true },
  { char: '-', label: 'Canceled', icon: 'minus', closed: true },
  { char: '>', label: 'Forwarded', icon: 'play' },
  { char: '<', label: 'Scheduling', icon: 'calendar' },
];

export function isClosedStatus(status: string): boolean {
  return status.toLowerCase() === 'x' || status === '-';
}

export const QUADRANTS: Quadrant[] = [
  'DO_IMMEDIATELY',
  'DO_REDUCED',
  'DELEGATE_PRIORITY',
  'DELEGATE',
  'SCHEDULE',
  'DEFER',
  'OPEN',
];

export const QUADRANT_META: Record<
  Quadrant,
  { label: string; subtitle: string; accent: string }
> = {
  DO_IMMEDIATELY: {
    label: 'DO IMMEDIATELY',
    subtitle: 'Important + Urgent',
    accent: 'var(--color-red)',
  },
  DO_REDUCED: {
    label: 'DO REDUCED QUALITY',
    subtitle: 'Not Important + Urgent',
    accent: 'var(--color-orange)',
  },
  DELEGATE_PRIORITY: {
    label: 'DELEGATE WITH PRIORITY',
    subtitle: 'Important + Urgent + Unable to do',
    accent: 'var(--color-purple)',
  },
  DELEGATE: {
    label: 'DELEGATE',
    subtitle: 'Not Important + Urgent',
    accent: 'var(--color-green)',
  },
  SCHEDULE: {
    label: 'SCHEDULE',
    subtitle: 'Not Urgent + Important',
    accent: 'var(--color-blue)',
  },
  DEFER: {
    label: 'DEFER',
    subtitle: 'Not Urgent + Not Important',
    accent: 'var(--color-yellow)',
  },
  OPEN: {
    label: 'OPEN',
    subtitle: 'No quadrant tag',
    accent: 'var(--text-muted)',
  },
};

export const PRIORITIES: Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];

export const PRIORITY_META: Record<
  Priority,
  { emoji: string; label: string; tone: string }
> = {
  highest: { emoji: '🔺', label: 'Highest', tone: 'var(--color-red)' },
  high: { emoji: '⏫', label: 'High', tone: 'var(--color-orange)' },
  medium: { emoji: '🔼', label: 'Medium', tone: 'var(--color-yellow)' },
  low: { emoji: '🔽', label: 'Low', tone: 'var(--color-cyan)' },
  lowest: { emoji: '⏬', label: 'Lowest', tone: 'var(--text-muted)' },
};
