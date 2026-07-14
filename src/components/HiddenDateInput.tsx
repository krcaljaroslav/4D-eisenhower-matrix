import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type HiddenDateInputHandle = { open: () => void };

type Props = {
  /** Aktuální hodnota (ISO `YYYY-MM-DD`) nebo `''` když není datum. */
  value: string;
  /** Zavolá se AŽ při reálném výběru dne (nativní `change`). `''` = prázdno. */
  onCommit: (value: string) => void;
  className?: string;
};

/**
 * Skrytý nativní `<input type="date">` otevíraný přes `ref.open()` → `showPicker()`.
 *
 * **BUG fix (skok o měsíc):** Chromium date-picker posílá DOM `input` událost i
 * při pouhé navigaci mezi měsíci (šipky ↑/↓ v kalendáři). React `onChange`
 * odpovídá `input`, takže controlled varianta datum potvrdila hned při přepnutí
 * měsíce — uživatelsky „skok přesně o měsíc" místo pouhého zobrazení dalšího
 * měsíce. Řešení:
 *   1. posloucháme jen nativní `change` (přijde až při kliknutí na den / Enter),
 *   2. input necháme *uncontrolled* (`defaultValue` + `key`), ať React
 *      nepřepisuje hodnotu uprostřed interakce a nezavírá picker.
 * `key={value}` zajistí resync, když se datum změní jinudy (šipky v liště, ×).
 */
export const HiddenDateInput = forwardRef<HiddenDateInputHandle, Props>(
  function HiddenDateInput({ value, onCommit, className }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    // Držíme nejnovější callback v refu, ať se listener nemusí re-subscribovat
    // a přitom nevolá zastaralou closure.
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;

    useImperativeHandle(ref, () => ({
      open: () => {
        const el = inputRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
          try {
            el.showPicker();
            return;
          } catch {
            // showPicker může selhat (ne-visible element) — fallback na focus.
          }
        }
        el.focus();
      },
    }));

    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      const handler = () => onCommitRef.current(el.value);
      el.addEventListener('change', handler);
      return () => el.removeEventListener('change', handler);
    }, []);

    return (
      <input
        ref={inputRef}
        key={value}
        type="date"
        defaultValue={value}
        className={className ?? 'em-sr-only'}
        aria-hidden
        tabIndex={-1}
      />
    );
  },
);
