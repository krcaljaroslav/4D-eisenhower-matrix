import { addIcon, Plugin, WorkspaceLeaf } from 'obsidian';
import { MatrixView, VIEW_TYPE_MATRIX } from './src/view/MatrixView.ts';
import { DEFAULT_SETTINGS, type PluginSettings } from './src/settings/settings.ts';
import { MatrixSettingsTab } from './src/settings/SettingsTab.ts';
import type { Quadrant } from './src/core/types.ts';

// Vlastní ikona pro stav "In progress" [/] — Lucide nemá half-square,
// tak ji zaregistrujeme: hranatý rámeček + vyplněná levá polovina (Things-style).
// addIcon očekává obsah SVG s viewBoxem 0 0 100 100.
const SQUARE_HALF_ICON = `<rect x="14" y="14" width="72" height="72" rx="12" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 18 L24 18 A6 6 0 0 0 18 24 L18 76 A6 6 0 0 0 24 82 L50 82 Z" fill="currentColor"/>`;

export default class EisenhowerMatrixPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  /**
   * Callback registrované MatrixView při vytvoření — voláme ho po změně settings,
   * aby repo přepočítalo daily folder + excluded folders.
   */
  private repoConfigCallbacks: Set<() => void> = new Set();

  async onload(): Promise<void> {
    await this.loadSettings();

    addIcon('em-square-half', SQUARE_HALF_ICON);

    this.registerView(VIEW_TYPE_MATRIX, (leaf) => new MatrixView(leaf, this));

    this.addRibbonIcon('layout-grid', 'Open Eisenhower matrix', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open',
      name: 'Open matrix',
      callback: () => {
        void this.activateView();
      },
    });

    this.addSettingTab(new MatrixSettingsTab(this.app, this));
  }

  async onunload(): Promise<void> {
    // Obsidian uvolní view / ribbon / command / settings tab automaticky.
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as any;
    
    // Map old kanbanQuadrant if it exists
    let kanbanQuadrant = loaded?.kanbanQuadrant;
    if (kanbanQuadrant === 'DO') kanbanQuadrant = 'DO_IMMEDIATELY';
    else if (kanbanQuadrant === 'DECIDE') kanbanQuadrant = 'SCHEDULE';
    else if (kanbanQuadrant === 'DELETE') kanbanQuadrant = 'DEFER';

    // Map old collapsedQuadrants if they exist
    const collapsedQuadrants = { ...DEFAULT_SETTINGS.collapsedQuadrants };
    if (loaded?.collapsedQuadrants) {
      const old = loaded.collapsedQuadrants;
      if (old.DO !== undefined) collapsedQuadrants.DO_IMMEDIATELY = old.DO;
      if (old.DECIDE !== undefined) collapsedQuadrants.SCHEDULE = old.DECIDE;
      if (old.DELEGATE !== undefined) collapsedQuadrants.DELEGATE = old.DELEGATE;
      if (old.DELETE !== undefined) collapsedQuadrants.DEFER = old.DELETE;
      if (old.OPEN !== undefined) collapsedQuadrants.OPEN = old.OPEN;

      // Copy new format values too, if present
      for (const k of Object.keys(DEFAULT_SETTINGS.collapsedQuadrants) as Quadrant[]) {
        if (old[k] !== undefined) {
          collapsedQuadrants[k] = old[k];
        }
      }
    }

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      collapsedQuadrants,
      kanbanQuadrant: kanbanQuadrant !== undefined ? kanbanQuadrant : DEFAULT_SETTINGS.kanbanQuadrant,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  registerRepoConfigCallback(cb: () => void): () => void {
    this.repoConfigCallbacks.add(cb);
    return () => this.repoConfigCallbacks.delete(cb);
  }

  /** Voláno z SettingsTab po změně daily folderu / excluded folders. */
  notifyRepoConfigChanged(): void {
    for (const cb of this.repoConfigCallbacks) cb();
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;

    const existing = workspace.getLeavesOfType(VIEW_TYPE_MATRIX);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf: WorkspaceLeaf | null = workspace.getLeaf('tab');
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_MATRIX, active: true });
    workspace.revealLeaf(leaf);
  }
}
