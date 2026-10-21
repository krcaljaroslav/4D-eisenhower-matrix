export function isTaskDragEnabled(isMobile: boolean, touchDrag: boolean): boolean {
  return !isMobile || touchDrag === true;
}
