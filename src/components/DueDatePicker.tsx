import { useRef } from 'react';
import { HiddenDateInput, type HiddenDateInputHandle } from './HiddenDateInput.tsx';

type Props = {
  currentDueDate?: string;
  onChange: (next: string | null) => Promise<void> | void;
  variant: 'badge' | 'add';
  overdue?: boolean;
};

/**
 * Klik na badge → rovnou native date picker (žádný popover dialog).
 * Pokud má task už due date, vedle se zobrazí × pro odstranění.
 *
 * Pattern: identický s 📅 tlačítkem v AddTaskInput. Konzistentní s tím,
 * jak se due date nastavuje při vytváření tasku.
 */
export function DueDatePicker({ currentDueDate, onChange, variant, overdue }: Props) {
  const dateInputRef = useRef<HiddenDateInputHandle>(null);

  const openPicker = () => dateInputRef.current?.open();

  const handleCommit = (raw: string) => {
    const newValue = raw || null;
    if (newValue !== (currentDueDate ?? null)) {
      void onChange(newValue);
    }
  };

  const isBadgeWithDate = variant === 'badge' && currentDueDate;

  return (
    <span className="em-inline-flex">
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
        className={`em-badge ${isBadgeWithDate ? 'em-badge-clickable' : 'em-badge-add'} ${
          overdue ? 'em-badge-overdue' : ''
        }`}
        title={currentDueDate ? 'Click to edit due date' : 'Add due date'}
      >
        {currentDueDate ? `📅 ${currentDueDate}` : '+ 📅'}
      </button>
      {isBadgeWithDate && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void onChange(null);
          }}
          className="em-badge-clear"
          title="Remove due date"
        >
          ×
        </button>
      )}
      <HiddenDateInput
        ref={dateInputRef}
        value={currentDueDate ?? ''}
        onCommit={handleCommit}
      />
    </span>
  );
}
