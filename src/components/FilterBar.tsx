import { UNTAGGED_FILTER } from '../core/taskUtils.ts';

type Props = {
  availableTags: { tag: string; count: number }[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
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
  onToggle,
  onClear,
  totalCount,
  filteredCount,
}: Props) {
  if (availableTags.length === 0) return null;

  const active = selectedTags.length > 0;

  return (
    <div className="em-filterbar">
      <span className="em-filterbar-label">Filter:</span>
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
