const CANVAS_BACKGROUNDS = ['em-graph-viewport', 'em-graph-scaler', 'em-graph-canvas', 'em-graph-edges', 'em-graph-nodes'];

export function centeredScrollOffset(scrollSize: number, clientSize: number): number {
  return Math.max(0, (scrollSize - clientSize) / 2);
}

export function isGraphCanvasBackground(target: EventTarget | null): boolean {
  const classList = (target as { classList?: { contains(name: string): boolean } } | null)?.classList;
  return Boolean(classList && CANVAS_BACKGROUNDS.some((name) => classList.contains(name)));
}
