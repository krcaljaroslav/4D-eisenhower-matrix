import { Plugin, WorkspaceLeaf } from 'obsidian';
import { MatrixView, VIEW_TYPE_MATRIX } from './src/view/MatrixView.ts';
import { DEFAULT_SETTINGS, type PluginSettings } from './src/settings/settings.ts';
import { MatrixSettingsTab } from './src/settings/SettingsTab.ts';

export default class EisenhowerMatrixPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  /**
   * Callback registrované MatrixView při vytvoření — voláme ho po změně settings,
   * aby repo přepočítalo daily folder + excluded folders.
   */
  private repoConfigCallbacks: Set<() => void> = new Set();

  async onload(): Promise<void> {
    console.log('[Eisenhower Matrix] loading plugin');
    await this.loadSettings();

    this.registerView(VIEW_TYPE_MATRIX, (leaf) => new MatrixView(leaf, this));

    this.addRibbonIcon('layout-grid', 'Open Eisenhower Matrix', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-eisenhower-matrix',
      name: 'Open Eisenhower Matrix',
      callback: () => {
        void this.activateView();
      },
    });

    this.addSettingTab(new MatrixSettingsTab(this.app, this));
  }

  async onunload(): Promise<void> {
    console.log('[Eisenhower Matrix] unloading plugin');
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<PluginSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      collapsedQuadrants: {
        ...DEFAULT_SETTINGS.collapsedQuadrants,
        ...(loaded?.collapsedQuadrants ?? {}),
      },
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
