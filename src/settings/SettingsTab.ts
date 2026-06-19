import { type App, PluginSettingTab, Setting } from 'obsidian';
import type EisenhowerMatrixPlugin from '../../main.ts';
import { getDailyNotesFolder } from '../obsidian-adapter/dailyNotes.ts';
import { FolderSuggest } from './FolderSuggest.ts';

export class MatrixSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: EisenhowerMatrixPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // No plugin-name heading — Obsidian renders it itself.

    // === Daily folder override ===
    const coreFolder = getDailyNotesFolder(this.app, '');
    const coreLabel = coreFolder ? `\`${coreFolder}\`` : '(vault root)';

    new Setting(containerEl)
      .setName('Daily folder')
      .setDesc(
        `Folder where new daily notes are created. Leave empty to use the core "Daily notes" plugin config — currently ${coreLabel}.`,
      )
      .addText((text) => {
        text
          .setPlaceholder('e.g. Daily (or leave empty)')
          .setValue(this.plugin.settings.dailyFolderOverride)
          .onChange(async (value) => {
            this.plugin.settings.dailyFolderOverride = value.trim();
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    // === Daily section heading ===
    new Setting(containerEl)
      .setName('Daily section heading')
      .setDesc(
        'Heading in the daily note under which today\'s tasks are read and added. New tasks go below it; if missing, it is created automatically.',
      )
      .addText((text) =>
        text
          .setPlaceholder('# Today')
          .setValue(this.plugin.settings.dailySectionHeading)
          .onChange(async (value) => {
            const trimmed = value.trim();
            // Fallback to default if the user clears it.
            this.plugin.settings.dailySectionHeading = trimmed || '# Today';
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
          }),
      );

    // === Excluded folders ===
    this.renderExcludedFoldersSection(containerEl);

    // === Reset ===
    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc(
        'Clears overrides — daily folder falls back to the core config, excluded folders are emptied.',
      )
      .addButton((btn) =>
        btn
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.dailyFolderOverride = '';
            this.plugin.settings.excludedFolders = [];
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
            this.display();
          }),
      );
  }

  /**
   * Excluded folders — list of rows with × + an add input with a folder
   * suggester. Mirrors the native Obsidian "Excluded files" dialog.
   */
  private renderExcludedFoldersSection(parent: HTMLElement): void {
    new Setting(parent).setName('Excluded folders').setHeading();

    const section = parent.createDiv({ cls: 'em-settings-excluded' });

    section.createEl('p', {
      text: 'Tasks from these folders are hidden from the matrix. Click × to remove, or add a new folder below.',
      cls: 'setting-item-description',
    });

    const list = section.createDiv({ cls: 'em-excluded-list' });

    const folders = this.plugin.settings.excludedFolders;
    if (folders.length === 0) {
      list.createDiv({
        cls: 'em-excluded-empty',
        text: 'No excluded folders.',
      });
    } else {
      for (const folder of folders) {
        const row = list.createDiv({ cls: 'em-excluded-row' });
        row.createSpan({ text: folder, cls: 'em-excluded-path' });
        const removeBtn = row.createEl('button', {
          cls: 'em-excluded-remove',
          attr: { 'aria-label': `Remove ${folder}` },
          text: '×',
        });
        const removeFolder = async () => {
          this.plugin.settings.excludedFolders = folders.filter((f) => f !== folder);
          await this.plugin.saveSettings();
          this.plugin.notifyRepoConfigChanged();
          this.display();
        };
        removeBtn.addEventListener('click', () => void removeFolder());
      }
    }

    // Add row
    const addRow = section.createDiv({ cls: 'em-excluded-add' });
    const addInput = addRow.createEl('input', {
      type: 'text',
      cls: 'em-excluded-input',
      attr: { placeholder: 'Add a folder…' },
    });
    new FolderSuggest(this.app, addInput);

    const addBtn = addRow.createEl('button', {
      cls: 'mod-cta em-excluded-add-btn',
      text: 'Add',
    });

    const tryAdd = async () => {
      const value = addInput.value.trim();
      if (!value) return;
      const existing = this.plugin.settings.excludedFolders.map((f) => f.toLowerCase());
      if (existing.includes(value.toLowerCase())) {
        addInput.value = '';
        return;
      }
      this.plugin.settings.excludedFolders = [
        ...this.plugin.settings.excludedFolders,
        value,
      ];
      await this.plugin.saveSettings();
      this.plugin.notifyRepoConfigChanged();
      this.display();
    };

    addBtn.addEventListener('click', () => void tryAdd());
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void tryAdd();
      }
    });
  }
}
