import { createElement, type ReactNode } from 'react';

/**
 * Lehký inline-markdown renderer pro text tasku. Záměrně řeší jen
 * ZÁKLADNÍ formátování:
 *   **tučné**  ·  *kurzíva*  ·  ~~přeškrtnuté~~  ·  `kód`
 *
 * NErenderuje #tagy ani [[odkazy]] — ty zůstávají jako plain text
 * (tagy má karta jako vlastní badge, odkazy nechceme klikatelné).
 */

type InlineTag = 'strong' | 'em' | 'del' | 'code';

// Pořadí je důležité: `**` musí být před `*`, aby se na shodném indexu
// vyhodnotil bold dřív než kurzíva.
const PATTERNS: { re: RegExp; tag: InlineTag }[] = [
  { re: /\*\*(.+?)\*\*/, tag: 'strong' },
  { re: /~~(.+?)~~/, tag: 'del' },
  { re: /`([^`]+?)`/, tag: 'code' },
  { re: /\*(.+?)\*/, tag: 'em' },
];

export function renderInlineMarkdown(text: string): ReactNode {
  let keyCounter = 0;

  const parse = (input: string): ReactNode[] => {
    let best:
      | { index: number; matchLen: number; inner: string; tag: InlineTag }
      | null = null;

    for (const { re, tag } of PATTERNS) {
      const m = re.exec(input);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, matchLen: m[0].length, inner: m[1], tag };
      }
    }

    if (best === null) return input.length > 0 ? [input] : [];

    const before = input.slice(0, best.index);
    const after = input.slice(best.index + best.matchLen);
    // `kód` se renderuje doslova — uvnitř se další markdown neparsuje.
    const children = best.tag === 'code' ? best.inner : parse(best.inner);
    const el = createElement(best.tag, { key: `md${keyCounter++}` }, children);

    return [...(before.length > 0 ? [before] : []), el, ...parse(after)];
  };

  const nodes = parse(text);
  return nodes.length === 1 ? nodes[0] : nodes;
}
