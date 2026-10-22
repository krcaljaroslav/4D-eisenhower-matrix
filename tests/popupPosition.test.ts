import { describe, expect, it } from 'vitest';
import { computePopupPosition } from '../src/core/popupPosition.ts';

describe('computePopupPosition', () => {
  const popup = { width: 160, height: 180 };
  const viewport = { width: 800, height: 600 };

  it('fits within the viewport when neither side fits and below has more room', () => {
    expect(computePopupPosition({ left: 40, top: 130, bottom: 154 }, popup,
      { width: 800, height: 300 }))
      .toEqual({ top: 112, left: 40 });
  });

  it('keeps a popup inside the viewport when the anchor is below it', () => {
    expect(computePopupPosition({ left: 40, top: 700, bottom: 724 }, popup, viewport))
      .toEqual({ top: 412, left: 40 });
  });

  it('places a popup below when it fits exactly at the bottom margin', () => {
    expect(computePopupPosition({ left: 40, top: 400, bottom: 408 }, popup, viewport))
      .toEqual({ top: 412, left: 40 });
  });

  it('places a popup below an anchor near the top', () => {
    expect(computePopupPosition({ left: 40, top: 20, bottom: 44 }, popup, viewport))
      .toEqual({ top: 48, left: 40 });
  });

  it('places a popup above an anchor near the bottom', () => {
    expect(computePopupPosition({ left: 40, top: 550, bottom: 574 }, popup, viewport))
      .toEqual({ top: 366, left: 40 });
  });

  it('clamps to the top margin when neither side has enough room', () => {
    expect(computePopupPosition({ left: 40, top: 110, bottom: 134 }, popup,
      { width: 800, height: 200 }))
      .toEqual({ top: 8, left: 40 });
  });

  it('moves a popup left at the right viewport edge', () => {
    expect(computePopupPosition({ left: 750, top: 20, bottom: 44 }, popup, viewport))
      .toEqual({ top: 48, left: 632 });
  });

  it('keeps the left viewport margin', () => {
    expect(computePopupPosition({ left: -10, top: 20, bottom: 44 }, popup, viewport))
      .toEqual({ top: 48, left: 8 });
  });
});
