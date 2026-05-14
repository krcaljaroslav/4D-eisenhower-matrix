import type { Quadrant } from '../core/types.ts';

/**
 * Plugin nastavení — persistovaná napříč restarty Obsidianu přes
 * `plugin.loadData()` / `plugin.saveData()`.
 *
 * Toto NEzahrnuje `date` (currently viewed) — to se vždy resetuje na dnešek
 * při otevření view.
 */
export type PluginSettings = {
  selectedTags: string[];
  collapsedQuadrants: Record<Quadrant, boolean>;
  showCompleted: boolean;
  lastOpenedDate: string | null;
  excludedFolders: string[];
  /**
   * Override pro daily notes folder. Prázdný string = použij konfiguraci
   * z core pluginu „Daily notes". Cesta relativní k vault rootu.
   */
  dailyFolderOverride: string;
};

export const DEFAULT_SETTINGS: PluginSettings = {
  selectedTags: [],
  collapsedQuadrants: {
    DO: false,
    DECIDE: false,
    DELEGATE: false,
    DELETE: false,
    OPEN: false,
  },
  showCompleted: false,
  lastOpenedDate: null,
  excludedFolders: ['_templates', '1_Agents'],
  dailyFolderOverride: '',
};
