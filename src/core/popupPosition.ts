type AnchorRect = { left: number; top: number; bottom: number };
type Size = { width: number; height: number };

export function computePopupPosition(anchorRect: AnchorRect, popupSize: Size, viewport: Size) {
  const margin = 8;
  const gap = 4;
  const below = anchorRect.bottom + gap;
  const spaceBelow = viewport.height - margin - below;
  const spaceAbove = anchorRect.top - gap - margin;
  const top = popupSize.height > spaceBelow && spaceAbove > spaceBelow
    ? anchorRect.top - gap - popupSize.height
    : below;

  return {
    top: Math.max(margin, top),
    left: Math.max(margin, Math.min(anchorRect.left, viewport.width - popupSize.width - margin)),
  };
}
