import { createElement, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

/**
 * Lehký inline-markdown renderer pro text tasku. Řeší:
 *   **tučné**  ·  *kurzíva*  ·  ~~přeškrtnuté~~  ·  `kód`
 *   [[wikilink]] / [[wikilink#heading|alias]]  ·  [text](url | cesta)
 *
 * Plus: pokud text začíná `# ` až `###### `, vykreslí se jako nadpis
 * (větší + tučné, vnitřek se dál parsuje inline).
 *
 * Odkazy jsou klikatelné — po kliknutí se zavolá `onLink`. Klik má
 * stopPropagation na pointer/mouse/dblclick, aby nespustil drag karty
 * ani edit. Bez `onLink` se vykreslí jako neaktivní (transientní overlay).
 * #tagy nerenderujeme (karta je má jako vlastní badge).
 */

export type InlineLinkTarget = {
  /** Cíl: u `[[wiki]]` link-text (bez závorek), u `[t](url)` URL/cesta. */
  target: string;
  /** true = externí URL (schéma nebo `//`) → otevřít v prohlížeči. */
  external: boolean;
  /** Ctrl/Cmd/prostřední tlačítko → otevřít v novém panelu. */
  newLeaf: boolean;
};

export type InlineLinkHandler = (t: InlineLinkTarget) => void;

type InlineTag = 'strong' | 'em' | 'del' | 'code';

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const WIKILINK_RE = /\[\[([^[\]]+?)\]\]/;
const MDLINK_RE = /\[([^\]]*?)\]\(([^()\s]+?)\)/;

// Bezpečnostní allowlist: externě se smí otevřít jen http(s) a mailto.
// Cokoli jiného se schématem (javascript:, file:, data:, protocol-relative
// `//`…) se NElinkuje vůbec — zůstane plain text. Bez schématu = interní
// cesta ve vaultu (řeší openLinkText, neškodné).
const HAS_SCHEME_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const SAFE_EXTERNAL_RE = /^(https?:\/\/|mailto:)/i;

// Pořadí: `**` před `*`, aby se na shodném indexu vyhodnotil bold dřív.
const FORMAT_PATTERNS: { re: RegExp; tag: InlineTag }[] = [
  { re: /\*\*(.+?)\*\*/, tag: 'strong' },
  { re: /~~(.+?)~~/, tag: 'del' },
  { re: /`([^`]+?)`/, tag: 'code' },
  { re: /\*(.+?)\*/, tag: 'em' },
];

export function renderInlineMarkdown(text: string, onLink?: InlineLinkHandler): ReactNode {
  let keyCounter = 0;

  const makeAnchor = (display: ReactNode, target: string, external: boolean): ReactNode =>
    createElement(
      'a',
      {
        key: `md${keyCounter++}`,
        className: `em-task-link${external ? ' em-task-link-external' : ''}`,
        href: '#',
        title: external ? target : `↳ ${target}`,
        onPointerDown: (e: PointerEvent) => e.stopPropagation(),
        onMouseDown: (e: MouseEvent) => e.stopPropagation(),
        onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
        onClick: (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onLink?.({
            target,
            external,
            newLeaf: e.ctrlKey || e.metaKey || e.button === 1,
          });
        },
      },
      display,
    );

  const parse = (input: string): ReactNode[] => {
    type Cand = { index: number; len: number; node: ReactNode };
    // Posbíráme všechny kandidáty a vybereme ten s nejmenším indexem;
    // při shodě vyhrává dřív přidaný (pořadí = priorita: wiki, md, formát).
    const cands: Cand[] = [];

    // [[wikilink]] / [[wikilink#heading|alias]]
    const wiki = WIKILINK_RE.exec(input);
    if (wiki) {
      const raw = wiki[1];
      const pipe = raw.indexOf('|');
      const target = (pipe === -1 ? raw : raw.slice(0, pipe)).trim();
      const alias = (pipe === -1 ? raw : raw.slice(pipe + 1)).trim();
      const display = alias.length > 0 ? alias : target;
      cands.push({ index: wiki.index, len: wiki[0].length, node: makeAnchor(display, target, false) });
    }

    // [text](url | cesta) — první výskyt s POVOLENÝM cílem. Odkaz s jiným
    // schématem se přeskočí (zůstane plain text) a hledá se další za ním,
    // aby zakázaný odkaz nezastínil povolený dál na řádku.
    let mdFrom = 0;
    while (mdFrom < input.length) {
      const md = MDLINK_RE.exec(input.slice(mdFrom));
      if (!md) break;
      const index = mdFrom + md.index;
      const url = md[2];
      const external = SAFE_EXTERNAL_RE.test(url);
      if (HAS_SCHEME_RE.test(url) && !external) {
        mdFrom = index + md[0].length;
        continue;
      }
      const label = md[1];
      const display: ReactNode = label.length > 0 ? parse(label) : url;
      cands.push({ index, len: md[0].length, node: makeAnchor(display, url, external) });
      break;
    }

    // Inline formátování
    for (const { re, tag } of FORMAT_PATTERNS) {
      const m = re.exec(input);
      if (m) {
        // `kód` se renderuje doslova — uvnitř se další markdown neparsuje.
        const inner = tag === 'code' ? m[1] : parse(m[1]);
        const node = createElement(tag, { key: `md${keyCounter++}` }, inner);
        cands.push({ index: m.index, len: m[0].length, node });
      }
    }

    if (cands.length === 0) return input.length > 0 ? [input] : [];

    let best = cands[0];
    for (const c of cands) if (c.index < best.index) best = c;

    const before = input.slice(0, best.index);
    const after = input.slice(best.index + best.len);
    return [...(before.length > 0 ? [before] : []), best.node, ...parse(after)];
  };

  // Nadpis na začátku → obal vnitřek do <span> s heading třídou.
  const headingMatch = HEADING_RE.exec(text);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const innerNodes = parse(headingMatch[2]);
    return createElement(
      'span',
      { className: `em-task-heading em-task-heading-${level}` },
      innerNodes.length === 1 ? innerNodes[0] : innerNodes,
    );
  }

  const nodes = parse(text);
  return nodes.length === 1 ? nodes[0] : nodes;
}
