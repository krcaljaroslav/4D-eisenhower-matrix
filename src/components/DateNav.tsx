import { useRef } from 'react';
import { HiddenDateInput, type HiddenDateInputHandle } from './HiddenDateInput.tsx';

type Props = {
  date: string;
  today: string;
  existingDates: Set<string>;
  onChange: (newDate: string) => void;
};

/**
 * Posune ISO datum o `delta` dní (může být záporné).
 */
function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function DateNav({ date, today, existingDates, onChange }: Props) {
  const dateInputRef = useRef<HiddenDateInputHandle>(null);

  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const isToday = date === today;

  const openPicker = () => dateInputRef.current?.open();

  const dotIf = (d: string) => existingDates.has(d) ? <span className="em-dn-dot" aria-hidden /> : null;

  return (
    <div className="em-datenav">
      <button
        type="button"
        onClick={() => onChange(prev)}
        className="em-dn-btn"
        title={`Previous day (${prev})`}
        aria-label="Previous day"
      >
        ← {dotIf(prev)}
      </button>

      <button
        type="button"
        onClick={openPicker}
        className="em-dn-date"
        title="Pick a date"
      >
        {date}
      </button>
      <HiddenDateInput
        ref={dateInputRef}
        value={date}
        onCommit={(v) => v && onChange(v)}
      />

      <button
        type="button"
        onClick={() => onChange(next)}
        className="em-dn-btn"
        title={`Next day (${next})`}
        aria-label="Next day"
      >
        → {dotIf(next)}
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="em-dn-today"
          title={`Jump to today (${today})`}
        >
          Today
        </button>
      )}
    </div>
  );
}
