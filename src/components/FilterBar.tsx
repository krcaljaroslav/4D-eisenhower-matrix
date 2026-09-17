import { UNTAGGED_FILTER, type DueFilter } from '../core/taskUtils.ts';

type Props = {
  availableTags: { tag: string; count: number }[];
  selectedTags: string[];
  dueFilter: DueFilter;
  selectedDate: string;
  onToggle: (tag: string) => void;
  onDueFilter: (f: DueFilter) => void;
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
};

function chipLabel(tag: string): string {
  return tag === UNTAGGED_FILTER ? 'Other' : tag;
}

export function FilterBar({
  availableTags,
  selectedTags,
  dueFilter,
  selectedDate,
  onToggle,
  onDueFilter,
  onClear,
  totalCount,
  filteredCount,
}: Props) {
  if (availableTags.length === 0) return null;

  const active = selectedTags.length > 0 || dueFilter !== 'none';

  return (
    <div className="em-filterbar">
      <span className="em-filterbar-label">Filter:</span>
      {/* Due-date rychlé filtry — vždy první, opticky odlišené (oranžové). */}
      <button
        type="button"
        onClick={() => onDueFilter('today')}
        className={`em-chip em-due-chip ${dueFilter === 'today' ? 'em-due-chip-active' : ''}`}
        aria-pressed={dueFilter === 'today'}
        title="Overdue + due today"
      >
        {dueFilter === 'today' && (
          <span className="em-chip-check" aria-hidden="true">
            ✓
          </span>
        )}
        <span>Today</span>
      </button>
      <button
        type="button"
        onClick={() => onDueFilter('selected')}
        className={`em-chip em-due-chip ${dueFilter === 'selected' ? 'em-due-chip-active' : ''}`}
        aria-pressed={dueFilter === 'selected'}
        title={`Due on the selected date (${selectedDate})`}
      >
        {dueFilter === 'selected' && (
          <span className="em-chip-check" aria-hidden="true">
            ✓
          </span>
        )}
        <span>Selected</span>
      </button>
      <button
        type="button"
        onClick={() => onDueFilter('week')}
        className={`em-chip em-due-chip ${dueFilter === 'week' ? 'em-due-chip-active' : ''}`}
        aria-pressed={dueFilter === 'week'}
        title="Overdue + due within the next 7 days"
      >
        {dueFilter === 'week' && (
          <span className="em-chip-check" aria-hidden="true">
            ✓
          </span>
        )}
        <span>This week</span>
      </button>
      {availableTags.map(({ tag, count }) => {
        const isSelected = selectedTags.some(
          (s) => s.toLowerCase() === tag.toLowerCase(),
        );
        const isUntagged = tag === UNTAGGED_FILTER;
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`em-chip ${isSelected ? 'em-chip-active' : ''} ${
              isUntagged ? 'em-chip-untagged' : ''
            }`}
            aria-pressed={isSelected}
            title={isUntagged ? 'Tasks without a context tag' : undefined}
          >
            {isSelected && (
              <span className="em-chip-check" aria-hidden="true">
                ✓
              </span>
            )}
            <span>{chipLabel(tag)}</span>
            <span className="em-chip-count">{count}</span>
          </button>
        );
      })}
      {active && (
        <>
          <span className="em-filterbar-sep">·</span>
          <button
            type="button"
            onClick={onClear}
            className="em-filterbar-clear"
          >
            clear
          </button>
          <span className="em-filterbar-stats">
            {filteredCount} / {totalCount}
          </span>
        </>
      )}
    </div>
  );
}
