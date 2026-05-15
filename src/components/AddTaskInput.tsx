import { useEffect, useRef, useState } from 'react';
import type { Priority, Quadrant } from '../core/types.ts';
import { PriorityPicker } from './PriorityPicker.tsx';

type Props = {
  quadrant: Quadrant;
  onSubmit: (input: {
    text: string;
    quadrant: Quadrant;
    dueDate: string | null;
    priority: Priority | null;
  }) => Promise<void>;
  onCancel: () => void;
};

function normalizeTagsInput(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
}

export function AddTaskInput({ quadrant, onSubmit, onCancel }: Props) {
  const [text, setText] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const tags = normalizeTagsInput(tagsRaw);
    const composed = tags.length > 0 ? `${tags.join(' ')} ${trimmed}` : trimmed;
    setPending(true);
    try {
      await onSubmit({
        text: composed,
        quadrant,
        dueDate: dueDate || null,
        priority,
      });
      setText('');
      setTagsRaw('');
      setDueDate('');
      setPriority(null);
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
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
    <div className="em-add-form">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Nový task do ${quadrant}… (Enter)`}
        disabled={pending}
        className="em-add-input em-add-input-text"
      />
      <input
        type="text"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="#tagy (mezerou oddělené, # se doplní)"
        disabled={pending}
        className="em-add-input em-add-input-tags"
      />
      <div className="em-add-controls">
        <button
          type="button"
          tabIndex={-1}
          onClick={openDatePicker}
          className={`em-badge ${dueDate ? 'em-badge-clickable' : 'em-badge-add'}`}
          title="Nastav due date"
        >
          📅 {dueDate || 'bez termínu'}
        </button>
        {dueDate && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setDueDate('')}
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
          onChange={(e) => {
            setDueDate(e.target.value);
            // Po zvolení data vrať focus do textu — Enter pak uloží task.
            inputRef.current?.focus();
          }}
          className="em-sr-only"
          aria-hidden
          tabIndex={-1}
        />

        <PriorityPicker value={priority} onChange={setPriority} disabled={pending} />

        <span className="em-add-hint">Enter = uložit · Esc = zrušit</span>
      </div>
    </div>
  );
}
