import { TouchSensor } from '@dnd-kit/core';

/** Capture context menus before Obsidian handles a long press. */
export function protectTouchDrag(card: Element, isActive: () => boolean): () => void {
  const ownerWindow = card.ownerDocument.defaultView;
  const suppressMenu = (event: Event) => {
    if (event.target instanceof Node && card.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const suppressSwipe = (event: Event) => {
    if (isActive()) event.stopPropagation();
  };
  ownerWindow?.addEventListener('contextmenu', suppressMenu, { capture: true });
  // The sensor receives the move at its original target before it bubbles to Obsidian.
  card.addEventListener('touchmove', suppressSwipe);
  return () => {
    ownerWindow?.removeEventListener('contextmenu', suppressMenu, { capture: true });
    card.removeEventListener('touchmove', suppressSwipe);
  };
}

export class ExperimentalTouchSensor extends TouchSensor {
  constructor(props: ConstructorParameters<typeof TouchSensor>[0]) {
    let active = false;
    let cleanup = () => {};
    const finish = () => {
      active = false;
      cleanup();
    };
    super({
      ...props,
      onStart: (coordinates) => {
        active = true;
        props.onStart(coordinates);
      },
      onAbort: (identifier) => {
        finish();
        props.onAbort(identifier);
      },
      onEnd: () => {
        finish();
        props.onEnd();
      },
      onCancel: () => {
        finish();
        props.onCancel();
      },
    });
    const target = props.event.target;
    if (target instanceof Element) {
      const card = target.closest('.em-task');
      if (card) cleanup = protectTouchDrag(card, () => active);
    }
  }
}
