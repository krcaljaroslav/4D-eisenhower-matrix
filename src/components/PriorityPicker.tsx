import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePopupPosition } from '../core/popupPosition.ts';
import type { Priority } from '../core/types.ts';
import { PRIORITIES, PRIORITY_META } from '../core/types.ts';

type Props = {
  value: Priority | null;
  onChange: (next: Priority | null) => Promise<void> | void;
  disabled?: boolean;
};

type Position = { top: number; left: number; maxHeight: number };

export function PriorityPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const recomputePosition = useCallback(() => {
    const el = triggerRef.current;
    const popover = popoverRef.current;
    if (!el || !popover) return;
    const win = el.ownerDocument.defaultView ?? window;
    const viewportHeight = win.visualViewport?.height ?? win.innerHeight;
    const offsetTop = win.visualViewport?.offsetTop ?? 0;
    const maxHeight = Math.max(0, viewportHeight - 16);
    popover.style.maxHeight = `${maxHeight}px`;
    const rect = el.getBoundingClientRect();
    const position = computePopupPosition({
      left: rect.left, top: rect.top - offsetTop, bottom: rect.bottom - offsetTop,
    }, popover.getBoundingClientRect(), {
      width: win.innerWidth, height: viewportHeight,
    });
    setPos({ ...position, top: position.top + offsetTop, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (open) recomputePosition();
  }, [open, value, recomputePosition]);

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
    const onScroll = (e: Event) => {
      if (e.target && 'nodeType' in e.target && popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const t = win.setTimeout(() => {
      doc.addEventListener('click', onDocClick);
      doc.addEventListener('keydown', onKey);
      win.addEventListener('scroll', onScroll, true);
      win.addEventListener('resize', recomputePosition);
      win.visualViewport?.addEventListener('resize', recomputePosition);
    }, 0);
    return () => {
      win.clearTimeout(t);
      doc.removeEventListener('click', onDocClick);
      doc.removeEventListener('keydown', onKey);
      win.removeEventListener('scroll', onScroll, true);
      win.removeEventListener('resize', recomputePosition);
      win.visualViewport?.removeEventListener('resize', recomputePosition);
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
    open
      ? createPortal(
          <div
            ref={popoverRef}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos?.top ?? 8, left: pos?.left ?? 8, maxHeight: pos?.maxHeight, overflowY: 'auto', boxSizing: 'border-box', visibility: pos ? undefined : 'hidden', zIndex: 1000 }}
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
