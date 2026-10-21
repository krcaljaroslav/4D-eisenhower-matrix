import type { TouchSensor } from '@dnd-kit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/settings.ts';
import { isTaskDragEnabled } from '../src/core/touchDrag.ts';
import { ExperimentalTouchSensor, protectTouchDrag } from '../src/components/ExperimentalTouchSensor.ts';

const sensor = vi.hoisted(() => ({ props: undefined as ConstructorParameters<typeof TouchSensor>[0] | undefined }));
vi.mock('@dnd-kit/core', () => ({
  TouchSensor: class { constructor(props: ConstructorParameters<typeof TouchSensor>[0]) { sensor.props = props; } },
}));

class Card extends EventTarget {
  ownerDocument = { defaultView: new EventTarget() };
  contains(target: unknown) { return target === this; }
  closest() { return this; }
}

afterEach(() => vi.unstubAllGlobals());

function cardFixture() {
  vi.stubGlobal('Node', Card);
  vi.stubGlobal('Element', Card);
  return new Card();
}

function contextMenu(card: Card, target: Card = card) {
  const event = new Event('contextmenu', { cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  card.ownerDocument.defaultView.dispatchEvent(event);
  return event;
}

describe('touch drag permission', () => {
  it('defaults to off', () => expect(DEFAULT_SETTINGS.touchDrag).toBe(false));
  it.each([
    [true, false, false], [true, true, true],
    [false, false, true], [false, true, true],
  ])('mobile=%s enabled=%s permits drag=%s', (mobile, enabled, expected) => {
    expect(isTaskDragEnabled(mobile, enabled)).toBe(expected);
  });
});

describe('touch gesture protection', () => {
  it('blocks context menus only on the touched card, and releases listeners', () => {
    const card = cardFixture();
    const cleanup = protectTouchDrag(card as unknown as Element, () => false);
    expect(contextMenu(card).defaultPrevented).toBe(true);
    expect(contextMenu(card, new Card()).defaultPrevented).toBe(false);
    cleanup();
    expect(contextMenu(card).defaultPrevented).toBe(false);
  });

  it('allows pending scroll, blocks active swipe propagation, and cleans up', () => {
    const card = cardFixture();
    let active = false;
    const cleanup = protectTouchDrag(card as unknown as Element, () => active);
    const move = () => {
      const event = new Event('touchmove', { cancelable: true });
      const stop = vi.spyOn(event, 'stopPropagation');
      card.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      return stop;
    };
    expect(move()).not.toHaveBeenCalled();
    active = true;
    expect(move()).toHaveBeenCalledOnce();
    cleanup();
    expect(move()).not.toHaveBeenCalled();
  });

  it.each(['onAbort', 'onEnd', 'onCancel'] as const)('releases protection on %s', (finish) => {
    const card = cardFixture();
    const callbacks = { onStart: vi.fn(), onAbort: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() };
    new ExperimentalTouchSensor({ ...callbacks, event: { target: card } } as unknown as ConstructorParameters<typeof ExperimentalTouchSensor>[0]);
    expect(contextMenu(card).defaultPrevented).toBe(true);
    if (finish !== 'onAbort') {
      sensor.props!.onStart({ x: 0, y: 0 });
      expect(callbacks.onStart).toHaveBeenCalledOnce();
    }
    if (finish === 'onAbort') sensor.props!.onAbort('task');
    else sensor.props![finish]();
    expect(callbacks[finish]).toHaveBeenCalledOnce();
    expect(contextMenu(card).defaultPrevented).toBe(false);
  });
});
