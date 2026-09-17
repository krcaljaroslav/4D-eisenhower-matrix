import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Priority } from '../core/types.ts';
import { PRIORITIES, PRIORITY_META } from '../core/types.ts';

type Props = {
  value: Priority | null;
  onChange: (next: Priority | null) => Promise<void> | void;
  disabled?: boolean;
};

type Position = { top: number; left: number };

export function PriorityPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const recomputePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const win = el.ownerDocument.defaultView ?? window;
    const rect = el.getBoundingClientRect();
    const popoverWidth = 160;
    const left = Math.min(rect.left, win.innerWidth - popoverWidth - 8);
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, []);

  useLayoutEffect(() => {
    if (open) recomputePosition();
  }, [open, recomputePosition]);

  useEffect(() => {
    if (!open) return;
    const doc = triggerRef.current?.ownerDocument ?? activeDocument;
    const win = doc.defaultView ?? activeWindow;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const t = win.setTimeout(() => {
      doc.addEventListener('click', onDocClick);
      doc.addEventListener('keydown', onKey);
      win.addEventListener('scroll', onScroll, true);
      win.addEventListener('resize', recomputePosition);
    }, 0);
    return () => {
      win.clearTimeout(t);
      doc.removeEventListener('click', onDocClick);
      doc.removeEventListener('keydown', onKey);
      win.removeEventListener('scroll', onScroll, true);
      win.removeEventListener('resize', recomputePosition);
    };
  }, [open, recomputePosition]);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      className={`em-badge ${value ? 'em-badge-clickable' : 'em-badge-add'}`}
      title="Set priority"
      style={value ? { color: PRIORITY_META[value].tone } : undefined}
    >
      {value
        ? `${PRIORITY_META[value].emoji} ${PRIORITY_META[value].label}`
        : '+ ⏫ priority'}
    </button>
  );

  const doc = triggerRef.current?.ownerDocument ?? activeDocument;
  const popover =
    open && pos
      ? createPortal(
          <div
            ref={popoverRef}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}
            className="em-popover em-popover-menu"
            role="menu"
          >
            {PRIORITIES.map((p) => {
              const meta = PRIORITY_META[p];
              const active = value === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    void onChange(p);
                    setOpen(false);
                  }}
                  className={`em-menu-item ${active ? 'em-menu-item-active' : ''}`}
                  role="menuitem"
                  style={{ color: meta.tone }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
            {value && (
              <button
                type="button"
                onClick={() => {
                  void onChange(null);
                  setOpen(false);
                }}
                className="em-menu-item em-menu-item-danger"
                role="menuitem"
              >
                Remove priority
              </button>
            )}
          </div>,
          doc.body,
        )
      : null;

  return (
    <span className="em-inline-flex">
      {trigger}
      {popover}
    </span>
  );
}
