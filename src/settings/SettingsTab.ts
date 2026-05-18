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

    // Pozn.: žádný plugin-name nadpis — Obsidian ho v settings renderuje sám.

    // === Daily folder override ===
    const coreFolder = getDailyNotesFolder(this.app, '');
    const coreLabel = coreFolder ? `\`${coreFolder}\`` : '(vault root)';

    new Setting(containerEl)
      .setName('Daily folder')
      .setDesc(
        `Složka, kam plugin ukládá nové daily notes. Necháš-li prázdné, použije se konfigurace z core pluginu „Daily notes" — momentálně ${coreLabel}.`,
      )
      .addText((text) => {
        text
          .setPlaceholder('např. 6_Daily-Tasks (nebo prázdné)')
          .setValue(this.plugin.settings.dailyFolderOverride)
          .onChange(async (value) => {
            this.plugin.settings.dailyFolderOverride = value.trim();
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    // === Excluded folders (Obsidian-native pattern: rows + add input) ===
    this.renderExcludedFoldersSection(containerEl);

    // === Reset ===
    new Setting(containerEl)
      .setName('Resetovat na výchozí')
      .setDesc(
        'Smaže overrides — daily folder se vrátí na core config, vyloučené složky se vyprázdní.',
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
   * Vyloučené složky — list řádků s × + input se suggesterem + Přidat.
   * Vzor: native Obsidian "Vyloučené soubory" dialog.
   */
  private renderExcludedFoldersSection(parent: HTMLElement): void {
    new Setting(parent).setName('Vyloučené složky').setHeading();

    const section = parent.createDiv({ cls: 'em-settings-excluded' });

    section.createEl('p', {
      text: 'Tasky z těchto složek se v matici nezobrazují. Klikni × pro odebrání, nebo přidej novou složku dole.',
      cls: 'setting-item-description',
    });

    const list = section.createDiv({ cls: 'em-excluded-list' });

    const folders = this.plugin.settings.excludedFolders;
    if (folders.length === 0) {
      list.createDiv({
        cls: 'em-excluded-empty',
        text: 'Žádné vyloučené složky.',
      });
    } else {
      for (const folder of folders) {
        const row = list.createDiv({ cls: 'em-excluded-row' });
        row.createSpan({ text: folder, cls: 'em-excluded-path' });
        const removeBtn = row.createEl('button', {
          cls: 'em-excluded-remove',
          attr: { 'aria-label': `Odebrat ${folder}` },
          text: '×',
        });
        removeBtn.addEventListener('click', async () => {
          this.plugin.settings.excludedFolders = folders.filter((f) => f !== folder);
          await this.plugin.saveSettings();
          this.plugin.notifyRepoConfigChanged();
          this.display();
        });
      }
    }

    // Add row
    const addRow = section.createDiv({ cls: 'em-excluded-add' });
    const addInput = addRow.createEl('input', {
      type: 'text',
      cls: 'em-excluded-input',
      attr: { placeholder: 'Přidej složku…' },
    });
    new FolderSuggest(this.app, addInput);

    const addBtn = addRow.createEl('button', {
      cls: 'mod-cta em-excluded-add-btn',
      text: 'Přidat',
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

    addBtn.addEventListener('click', tryAdd);
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void tryAdd();
      }
    });
  }
}
