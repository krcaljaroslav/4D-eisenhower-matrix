import { describe, expect, it } from 'vitest';
import {
  assignCells,
  buildGraphLayout,
  buildGraphNodeSet,
  canToggleGraphBranch,
  computeHiddenByCollapse,
  cellToPoint,
  computeLevels,
  GRID,
  layoutBand,
  routeEdge,
  taskKey,
  validateGraphPositions,
  type Geometry,
} from '../src/core/graphLayout.ts';
import type { Task } from '../src/core/types.ts';

function task(text: string, lineIndex: number, overrides: Partial<Task> = {}): Task {
  return {
    lineIndex,
    raw: `- [ ] ${text}`,
    status: ' ',
    checked: false,
    text,
    quadrant: 'OPEN',
    contextTags: [],
    blockedBy: [],
    trailingTokens: [],
    isBlocked: false,
    blockedByTasks: [],
    blocksTasks: [],
    missingBlockers: [],
    hasCircularDependency: false,
    sourceFile: 'tasks.md',
    isFromDnes: false,
    ...overrides,
  };
}

function link(blocker: Task, dependent: Task): void {
  blocker.blocksTasks.push(dependent);
  dependent.blockedByTasks.push(blocker);
}

describe('graph node selection and collapse', () => {
  it('expands a seed transitively but excludes completed and unrelated tasks', () => {
    const a = task('A', 0); const b = task('B', 1); const c = task('C', 2); const unrelated = task('Other', 3);
    link(c, b); link(b, a); c.status = 'x'; c.checked = true;
    const hiddenDone = buildGraphNodeSet([a, b, c, unrelated], new Set([taskKey(a)]), false, new Set());
    expect(hiddenDone.nodes).toEqual([a, b]);
    expect(buildGraphNodeSet([a, b, c, unrelated], new Set([taskKey(a)]), true, new Set()).nodes).toEqual([a, b, c]);
  });

  it('keeps a shared blocker visible until every dependent branch is collapsed', () => {
    const blocker = task('Shared', 0); const left = task('Left', 1); const right = task('Right', 2);
    link(blocker, left); link(blocker, right);
    expect(computeHiddenByCollapse([blocker, left, right], new Set([taskKey(left)])).hidden.has(taskKey(blocker))).toBe(false);
    expect(computeHiddenByCollapse([blocker, left, right], new Set([taskKey(left), taskKey(right)])).hidden.has(taskKey(blocker))).toBe(true);
  });

  it('keeps a collapsed node expandable after its blockers become hidden', () => {
    const blocker = task('Blocker', 0); const dependent = task('Dependent', 1);
    link(blocker, dependent);
    const collapsedKeys = new Set([taskKey(dependent)]);
    const collapsed = computeHiddenByCollapse([blocker, dependent], collapsedKeys);

    expect(collapsed.hidden.has(taskKey(blocker))).toBe(true);
    expect(canToggleGraphBranch(dependent, collapsedKeys)).toBe(true);
  });
});

it('rejects malformed persisted graph positions', () => {
  expect(validateGraphPositions({ good_id: { col: 1, row: 0 }, 'bad id': { col: 0, row: 0 }, negative: { col: 0, row: -1 }, fraction: { col: 1.5, row: 0 } })).toEqual({ good_id: { col: 1, row: 0 } });
});

describe('computeLevels', () => {
  it('handles chains, diamonds, different blocker depths, and cycles', () => {
    const a = task('A', 0);
    const b = task('B', 1);
    const c = task('C', 2);
    const d = task('D', 3);
    const e = task('E', 4);
    link(a, b); link(a, c); link(b, d); link(c, d); link(a, e); link(d, e);
    const levels = computeLevels([a, b, c, d, e]);
    expect([a, b, c, d, e].map((node) => levels.get(taskKey(node))))
      .toEqual([0, 1, 1, 2, 3]);

    const x = task('X', 5);
    const y = task('Y', 6);
    link(x, y); link(y, x);
    const cyclic = computeLevels([a, x, y]);
    expect(cyclic.size).toBe(3);
    expect(cyclic.get(taskKey(x))).toBe(1);
    expect(cyclic.get(taskKey(y))).toBe(1);
  });

  it('assigns every node a level even when input order is reversed', () => {
    const blocker = task('Blocker', 0), dependent = task('Dependent', 1);
    link(blocker, dependent);
    const levels = computeLevels([dependent, blocker]);
    expect(levels.get(taskKey(blocker))).toBe(0);
    expect(levels.get(taskKey(dependent))).toBe(1);
  });
});

describe('assignCells', () => {
  it('keeps a manual card in place after a dependency is created', () => {
    const blocker = task('Blocker', 0), fixed = task('Fixed', 1, { id: 'fixed' });
    const manual = new Map([['fixed', { col: 4, row: 3 }]]);
    expect(assignCells([blocker, fixed], computeLevels([blocker, fixed]), manual, new Set(), '2026-09-08').get(taskKey(fixed))).toEqual({ col: 4, row: 3 });
    link(blocker, fixed);
    expect(assignCells([blocker, fixed], computeLevels([blocker, fixed]), manual, new Set(), '2026-09-08').get(taskKey(fixed))).toEqual({ col: 4, row: 3 });
  });
  it('keeps disconnected peers in stable order beside a node with a barycenter', () => {
    const blocker = task('A blocker', 0), connected = task('Z connected', 1), peer = task('B peer', 2);
    link(blocker, connected);
    const cells = assignCells([blocker, connected, peer], new Map([
      [taskKey(blocker), 0], [taskKey(connected), 1], [taskKey(peer), 1],
    ]), new Map(), new Set(), '2026-09-08');
    expect(cells.get(taskKey(peer))!.col).toBeLessThan(cells.get(taskKey(connected))!.col);
  });
  it('is deterministic, collision-free, and barycentrically uncrosses', () => {
    const a = task('A', 0);
    const b = task('B', 1);
    const x = task('X', 2);
    const y = task('Y', 3);
    link(b, x); link(a, y);
    const nodes = [a, b, x, y];
    const levels = computeLevels(nodes);
    const first = assignCells(nodes, levels, new Map(), new Set(), '2026-09-08');
    const second = assignCells(nodes, levels, new Map(), new Set(), '2026-09-08');

    expect([...first]).toEqual([...second]);
    expect(new Set([...first.values()].map(({ col, row }) => `${col}:${row}`)).size).toBe(nodes.length);
    expect(first.get(taskKey(y))!.col).toBeLessThan(first.get(taskKey(x))!.col);
  });

  it('keeps a manual cell and prevents auto placement in it', () => {
    const fixed = task('Fixed', 0, { id: 'fixed' });
    const automatic = task('Automatic', 1);
    const levels = computeLevels([fixed, automatic]);
    const cells = assignCells(
      [fixed, automatic], levels, new Map([['fixed', { col: 0, row: 0 }]]),
      new Set(), '2026-09-08',
    );
    expect(cells.get(taskKey(fixed))).toEqual({ col: 0, row: 0 });
    expect(cells.get(taskKey(automatic))).toEqual({ col: 1, row: 0 });
  });

  it('automatically places the second card when two manual positions collide', () => {
    const first = task('First', 0, { id: 'first' });
    const second = task('Second', 1, { id: 'second' });
    const occupied = task('Occupied', 2, { id: 'occupied' });
    const levels = new Map([[taskKey(first), 1], [taskKey(second), 1], [taskKey(occupied), 1]]);
    const cells = assignCells(
      [first, second, occupied], levels,
      new Map([
        ['first', { col: 7, row: 3 }],
        ['second', { col: 7, row: 3 }],
        ['occupied', { col: 0, row: 1 }],
      ]),
      new Set(), '2026-09-08',
    );
    expect(cells.get(taskKey(first))).toEqual({ col: 7, row: 3 });
    expect(cells.get(taskKey(second))).toEqual({ col: 1, row: 1 });
    expect(cells.get(taskKey(second))).not.toEqual(cells.get(taskKey(occupied)));
  });

  it('does not let a manual cell in another row shift automatic level one', () => {
    const fixed = task('A fixed', 0, { id: 'fixed' });
    const first = task('B first', 1);
    const second = task('C second', 2);
    const levels = new Map([
      [taskKey(fixed), 1], [taskKey(first), 1], [taskKey(second), 1],
    ]);
    const cells = assignCells(
      [fixed, first, second], levels, new Map([['fixed', { col: 7, row: 3 }]]),
      new Set(), '2026-09-08',
    );
    expect(cells.get(taskKey(first))).toEqual({ col: 0, row: 1 });
    expect(cells.get(taskKey(second))).toEqual({ col: 1, row: 1 });
  });

  it('keeps visible cells stable when a node is hidden', () => {
    const a = task('A', 0);
    const b = task('B', 1);
    const c = task('C', 2);
    const x = task('X', 3);
    const y = task('Y', 4);
    link(c, x);
    link(a, y);
    const nodes = [a, b, c, x, y];
    const levels = computeLevels(nodes);
    const expanded = assignCells(nodes, levels, new Map(), new Set(), '2026-09-08');
    const hiddenKey = taskKey(a);
    const collapsed = assignCells(nodes, levels, new Map(), new Set([hiddenKey]), '2026-09-08');

    for (const [key, cell] of expanded) {
      if (key !== hiddenKey) expect(collapsed.get(key)).toEqual(cell);
    }
  });

  it('keeps every visible cell stable across representative collapsed layouts', () => {
    for (let mask = 1; mask < 64; mask++) {
      const lower = [task('A', 0), task('B', 1), task('C', 2)];
      const upper = [task('X', 3), task('Y', 4)];
      for (let edge = 0; edge < 6; edge++) if (mask & (1 << edge)) link(lower[edge % 3], upper[Math.floor(edge / 3)]);
      const nodes = [...lower, ...upper];
      const levels = computeLevels(nodes);
      const expanded = assignCells(nodes, levels, new Map(), new Set(), '2026-09-08');
      for (const hidden of lower) {
        const hiddenKey = taskKey(hidden);
        const collapsed = assignCells(nodes, levels, new Map(), new Set([hiddenKey]), '2026-09-08');
        for (const [key, cell] of expanded) if (key !== hiddenKey) expect(collapsed.get(key), `mask ${mask}, hidden ${hidden.text}, key ${key}`).toEqual(cell);
      }
    }
  });

  it('orders an unlinked layer with makeCompareTask and omits hidden nodes', () => {
    const z = task('Zulu', 0);
    const a = task('Alpha', 1);
    const levels = computeLevels([z, a]);
    const cells = assignCells([z, a], levels, new Map(), new Set([taskKey(z)]), '2026-09-08');
    expect(cells.get(taskKey(a))).toEqual({ col: 0, row: 0 });
    expect(cells.has(taskKey(z))).toBe(false);
  });
});

describe('buildGraphLayout', () => {
  it('uses the wider compact geometry throughout the grid calculation', () => {
    const nodes = Array.from({ length: 5 }, (_, index) => task(String(index), index));
    const layout = buildGraphLayout({ tasks: nodes, seedKeys: new Set(nodes.map(taskKey)), showCompleted: false, graceKeys: new Set(), positions: {}, collapsedKeys: new Set(), compact: true, viewportWidth: 800, zoom: 1, today: '2026-09-08' });
    expect(GRID.compact.w).toBe(272);
    expect(layout.bandColumns).toBe(4);
    expect(layout.size.width).toBe(4 * (GRID.compact.w + GRID.gapX));
  });
  it('shows an otherwise unlinked task in its persisted manual cell', () => {
    const lone = task('Lone', 0, { id: 'lone' });
    const layout = buildGraphLayout({ tasks: [lone], seedKeys: new Set([taskKey(lone)]), showCompleted: false, graceKeys: new Set(), positions: { lone: { col: 3, row: 4 } }, collapsedKeys: new Set(), compact: false, viewportWidth: 800, zoom: 1, today: '2026-09-08' });
    expect(layout.nodes[0]).toMatchObject({ cell: { col: 3, row: 4 }, manual: true, inBand: false });
  });

  it('finishes and stacks nothing under a manually placed anchor sharing a column with an automatic one', () => {
    const l1 = task('L1', 0), l2 = task('L2', 1), m = task('M', 2, { id: 'm' }), a = task('A', 3);
    link(l1, m); link(m, a); link(l2, a);
    const layout = buildGraphLayout({ tasks: [l1, l2, m, a], seedKeys: new Set([taskKey(a)]), showCompleted: false, graceKeys: new Set<string>(), positions: { m: { col: 0, row: 1 } }, collapsedKeys: new Set<string>(), compact: false, viewportWidth: 800, zoom: 1, today: '2026-09-08' });
    const cells = layout.nodes.map((node) => `${node.cell.col}:${node.cell.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    const cellOf = (t: Task) => layout.nodes.find((node) => node.key === taskKey(t))!.cell;
    expect(cellOf(m)).toEqual({ col: 0, row: 1 });
    expect(cellOf(l2).row).toBeLessThan(cellOf(a).row);
  });

  it('keeps topRow stable when collapsing hides the highest automatic row', () => {
    const t = [0, 1, 2, 3, 4].map((index) => task(`t${index}`, index, index === 4 ? { id: 't4' } : {}));
    link(t[0], t[3]); link(t[1], t[4]); link(t[3], t[4]);
    const input = { tasks: t, seedKeys: new Set(t.map(taskKey)), showCompleted: false, graceKeys: new Set<string>(), positions: { t4: { col: 0, row: 1 } }, compact: false, viewportWidth: 800, zoom: 1, today: '2026-09-08' };
    const expanded = buildGraphLayout({ ...input, collapsedKeys: new Set<string>() }).topRow;
    expect(buildGraphLayout({ ...input, collapsedKeys: new Set([taskKey(t[4])]) }).topRow).toBe(expanded);
  });

  it('keeps topRow stable when a manually placed node is collapsed', () => {
    const blocker = task('Blocker', 0, { id: 'blocker' }), dependent = task('Dependent', 1);
    link(blocker, dependent);
    const input = { tasks: [blocker, dependent], seedKeys: new Set([taskKey(dependent)]), showCompleted: false, graceKeys: new Set<string>(), positions: { blocker: { col: 0, row: 5 } }, compact: false, viewportWidth: 800, zoom: 1, today: '2026-09-08' };
    expect(buildGraphLayout({ ...input, collapsedKeys: new Set<string>() }).topRow).toBe(6);
    expect(buildGraphLayout({ ...input, collapsedKeys: new Set([taskKey(dependent)]) }).topRow).toBe(6);
  });

});

describe('branch layout', () => {
  function broadTree() {
    const goal = task('Manažerský audit', 0);
    const anchors = Array.from({ length: 20 }, (_, index) => task(`Větev ${index}`, index + 1));
    const roots = anchors.flatMap((anchor, index) => {
      const pair = [task(`Podklad ${index}a`, 100 + index * 2), task(`Podklad ${index}b`, 101 + index * 2)];
      pair.forEach((root) => link(root, anchor));
      link(anchor, goal);
      return pair;
    });
    return { goal, anchors, roots, nodes: [goal, ...anchors, ...roots] };
  }

  const layoutInput = (nodes: Task[]) => ({ tasks: nodes, seedKeys: new Set(nodes.map(taskKey)), showCompleted: false, graceKeys: new Set<string>(), positions: {}, collapsedKeys: new Set<string>(), compact: false, viewportWidth: 800, zoom: 1, today: '2026-09-08' });

  it('keeps 20 anchors in one row and stacks both roots below each anchor without collisions', () => {
    const { anchors, roots, nodes } = broadTree();
    const layout = buildGraphLayout(layoutInput(nodes));
    const cells = new Map(layout.nodes.map((node) => [node.key, node.cell]));
    expect(new Set(anchors.map((anchor) => cells.get(taskKey(anchor))!.row))).toEqual(new Set([2]));
    expect(new Set(anchors.map((anchor) => cells.get(taskKey(anchor))!.col)).size).toBe(20);
    anchors.forEach((anchor, index) => {
      const anchorCell = cells.get(taskKey(anchor))!;
      expect(roots.slice(index * 2, index * 2 + 2).map((root) => cells.get(taskKey(root))))
        .toEqual([{ col: anchorCell.col, row: 1 }, { col: anchorCell.col, row: 0 }]);
    });
    expect(new Set([...cells.values()].map(({ col, row }) => `${col}:${row}`)).size).toBe(nodes.length);
  });

  it('places a shared root once below the lower-level anchor', () => {
    const root = task('Root', 0), lower = task('Lower', 1), upper = task('Upper', 2, { id: 'upper' });
    link(root, lower); link(lower, upper); link(root, upper);
    const cells = assignCells([root, lower, upper], computeLevels([root, lower, upper]), new Map([['upper', { col: 5, row: 2 }]]), new Set(), '2026-09-08');
    expect(cells.get(taskKey(root))!.col).toBe(cells.get(taskKey(lower))!.col);
    expect(cells.get(taskKey(root))!.row + 1).toBe(cells.get(taskKey(lower))!.row);
    expect([...cells.keys()].filter((key) => key === taskKey(root))).toHaveLength(1);
  });

  it('routes the second root sideways while the first root has a direct edge', () => {
    const anchor = task('Anchor', 0), first = task('A first', 1), second = task('B second', 2);
    link(first, anchor); link(second, anchor);
    const layout = buildGraphLayout(layoutInput([anchor, first, second]));
    const nodes = new Map(layout.nodes.map((node) => [node.key, node]));
    const firstEdge = layout.edges.find((edge) => edge.from === taskKey(first))!;
    const secondEdge = layout.edges.find((edge) => edge.from === taskKey(second))!;
    const source = cellToPoint(nodes.get(taskKey(second))!.cell, { ...GRID.full, gapX: GRID.gapX, gapY: GRID.gapY, topRow: layout.topRow });
    expect(firstEdge.points).toHaveLength(2);
    expect(secondEdge.points[0].x).toBe(source.x + GRID.full.w);
    for (let index = 1; index < secondEdge.points.length; index++) {
      const from = secondEdge.points[index - 1], to = secondEdge.points[index];
      if (from.x !== to.x) continue;
      for (const node of layout.nodes.filter((candidate) => candidate.key !== taskKey(second))) {
        const corner = cellToPoint(node.cell, { ...GRID.full, gapX: GRID.gapX, gapY: GRID.gapY, topRow: layout.topRow });
        const crosses = from.x > corner.x && from.x < corner.x + GRID.full.w
          && Math.max(from.y, to.y) > corner.y && Math.min(from.y, to.y) < corner.y + GRID.full.h;
        expect(crosses).toBe(false);
      }
    }
  });

  it('does not move linked cards when viewport width or zoom changes', () => {
    const { nodes } = broadTree();
    const input = layoutInput(nodes);
    const cells = (viewportWidth: number, zoom: number) => buildGraphLayout({ ...input, viewportWidth, zoom }).nodes
      .filter((node) => !node.inBand).map((node) => [node.key, node.cell]);
    expect(cells(320, .25)).toEqual(cells(2400, 2));
  });

  it('skips a manual cell inside a column below its anchor', () => {
    const anchor = task('Anchor', 0), first = task('A first', 1), fixed = task('B fixed', 2, { id: 'fixed' }), last = task('C last', 3);
    [first, fixed, last].forEach((root) => link(root, anchor));
    const levels = computeLevels([anchor, first, fixed, last]);
    const cells = assignCells([anchor, first, fixed, last], levels, new Map([['fixed', { col: 0, row: 1 }]]), new Set(), '2026-09-08');
    expect(cells.get(taskKey(fixed))).toEqual({ col: 0, row: 1 });
    expect(cells.get(taskKey(first))).toEqual({ col: 0, row: 2 });
    expect(cells.get(taskKey(last))).toEqual({ col: 0, row: 0 });
    expect(new Set([...cells.values()].map(({ col, row }) => `${col}:${row}`)).size).toBe(4);
  });

  it('grows the stack without spilling into another column', () => {
    const anchor = task('Anchor', 0), first = task('A first', 1), second = task('B second', 2);
    const obstacle = task('Obstacle', 3, { id: 'obstacle' });
    link(first, anchor); link(second, anchor);
    const cells = assignCells(
      [anchor, first, second, obstacle], computeLevels([anchor, first, second, obstacle]),
      new Map([['obstacle', { col: 0, row: 0 }]]), new Set(), '2026-09-08',
    );
    expect(cells.get(taskKey(first))!.col).toBe(cells.get(taskKey(anchor))!.col);
    expect(cells.get(taskKey(second))!.col).toBe(cells.get(taskKey(anchor))!.col);
    expect(cells.get(taskKey(first))!.row).toBeGreaterThan(cells.get(taskKey(second))!.row);
  });

  it('places a stack to the right when its manual anchor has no row below it', () => {
    const anchor = task('Anchor', 0, { id: 'anchor' }), first = task('A first', 1), second = task('B second', 2);
    link(first, anchor); link(second, anchor);
    const cells = assignCells(
      [anchor, first, second], computeLevels([anchor, first, second]),
      new Map([['anchor', { col: 0, row: 0 }]]), new Set(), '2026-09-08',
    );
    expect(cells.get(taskKey(first))).toEqual({ col: 1, row: 0 });
    expect(cells.get(taskKey(second))).toEqual({ col: 2, row: 0 });
  });

  it('does not reserve a blank stack row for a manually placed root', () => {
    const anchor = task('Anchor', 0), left = task('A left', 1, { id: 'left' });
    const automatic = task('B automatic', 2), right = task('C right', 3, { id: 'right' });
    link(left, anchor); link(automatic, anchor); link(right, anchor);
    const cells = assignCells(
      [anchor, left, automatic, right], computeLevels([anchor, left, automatic, right]),
      new Map([['left', { col: 0, row: 0 }], ['right', { col: 10, row: 0 }]]), new Set(), '2026-09-08',
    );
    expect(cells.get(taskKey(anchor))!.row).toBe(1);
    expect(cells.get(taskKey(automatic))).toEqual({ col: cells.get(taskKey(anchor))!.col, row: 0 });
  });
});

describe('layoutBand', () => {
  it('sorts left-to-right and fills negative rows', () => {
    const nodes = ['D', 'C', 'B', 'A', 'E'].map((text, index) => task(text, index));
    const cells = layoutBand(nodes, 2, '2026-09-08');
    expect(cells.get(taskKey(nodes[3]))).toEqual({ col: 0, row: -1 });
    expect(Math.min(...[...cells.values()].map(({ row }) => row))).toBe(-3);
  });
});

describe('coordinates and routeEdge', () => {
  const geometry: Geometry = { w: 240, h: 112, gapX: 40, gapY: 64, topRow: 4 };

  it('maps graph and band cells to the specified coordinate systems', () => {
    expect(cellToPoint({ col: 2, row: 1 }, geometry)).toEqual({ x: 560, y: 528 });
    expect(cellToPoint({ col: 1, row: -2 }, geometry)).toEqual({ x: 280, y: 1096 });
    const graphBottom = cellToPoint({ col: 0, row: 0 }, geometry).y + geometry.h;
    const bandTop = cellToPoint({ col: 0, row: -1 }, geometry).y;
    expect(graphBottom).toBeLessThan(bandTop);
  });

  it('routes adjacent and long edges orthogonally', () => {
    const direct = routeEdge({ col: 1, row: 0 }, { col: 1, row: 1 }, geometry);
    const adjacent = routeEdge({ col: 0, row: 0 }, { col: 2, row: 1 }, geometry);
    const long = routeEdge({ col: 0, row: 0 }, { col: 2, row: 3 }, geometry);
    expect(direct).toHaveLength(2);
    expect(adjacent).toHaveLength(4);
    expect(long).toHaveLength(6);
    for (const route of [direct, adjacent, long]) {
      for (let index = 1; index < route.length; index++) {
        expect(route[index].x === route[index - 1].x || route[index].y === route[index - 1].y).toBe(true);
      }
    }
  });

  it('offsets a stack side exit from the general gutter', () => {
    const side = routeEdge({ col: 0, row: 0 }, { col: 2, row: 2 }, geometry, true);
    const general = routeEdge({ col: 0, row: 0 }, { col: 2, row: 2 }, geometry);
    expect(side[1].x).toBe(general[2].x + 6);
  });

  it('keeps general routes outside foreign card interiors', () => {
    const routes = [
      routeEdge({ col: 0, row: 0 }, { col: 2, row: 3 }, geometry),
      routeEdge({ col: 0, row: 2 }, { col: 2, row: 2 }, geometry),
      routeEdge({ col: 2, row: 3 }, { col: 0, row: 0 }, geometry),
    ];
    const foreignCells = [
      { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 1, row: 2 }, { col: 1, row: 3 },
    ];

    for (const route of routes) {
      for (let index = 1; index < route.length; index++) {
        const from = route[index - 1];
        const to = route[index];
        for (const cell of foreignCells) {
          const corner = cellToPoint(cell, geometry);
          const crossesHorizontal = from.y === to.y
            && from.y > corner.y && from.y < corner.y + geometry.h
            && Math.max(from.x, to.x) > corner.x && Math.min(from.x, to.x) < corner.x + geometry.w;
          const crossesVertical = from.x === to.x
            && from.x > corner.x && from.x < corner.x + geometry.w
            && Math.max(from.y, to.y) > corner.y && Math.min(from.y, to.y) < corner.y + geometry.h;
          expect(crossesHorizontal || crossesVertical).toBe(false);
        }
      }
    }
  });
});
