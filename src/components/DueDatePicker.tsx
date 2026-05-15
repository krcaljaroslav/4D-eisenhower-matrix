import { useRef } from 'react';

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
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // showPicker může selhat (např. element ne-visible v některých prohlížečích) — fallback
      }
    }
    el.focus();
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null;
    if (newValue !== (currentDueDate ?? null)) {
      await onChange(newValue);
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
        title={currentDueDate ? 'Klikni pro editaci termínu' : 'Přidat termín'}
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
          title="Odstranit termín"
        >
          ×
        </button>
      )}
      <input
        ref={dateInputRef}
        type="date"
        value={currentDueDate ?? ''}
        onChange={handleDateChange}
        className="em-sr-only"
        aria-hidden
        tabIndex={-1}
      />
    </span>
  );
}
