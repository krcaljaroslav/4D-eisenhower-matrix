import { type App, PluginSettingTab, Setting } from 'obsidian';
import type EisenhowerMatrixPlugin from '../../main.ts';
import { getDailyNotesFolder } from '../obsidian-adapter/dailyNotes.ts';

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

    containerEl.createEl('h2', { text: 'Eisenhower Matrix — nastavení' });

    // === Daily folder override ===
    const coreFolder = getDailyNotesFolder(this.app, '');
    const coreLabel = coreFolder ? `\`${coreFolder}\`` : '(vault root)';

    new Setting(containerEl)
      .setName('Daily folder')
      .setDesc(
        `Složka, kam plugin ukládá nové daily notes. Necháš-li prázdné, použije se konfigurace z core pluginu „Daily notes" — momentálně ${coreLabel}.`,
      )
      .addText((text) =>
        text
          .setPlaceholder('např. 6_Daily-Tasks (nebo prázdné)')
          .setValue(this.plugin.settings.dailyFolderOverride)
          .onChange(async (value) => {
            this.plugin.settings.dailyFolderOverride = value.trim();
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
          }),
      );

    // === Excluded folders ===
    new Setting(containerEl)
      .setName('Vyloučené složky')
      .setDesc(
        'Složky, jejichž tasky se ignorují (templates, agents apod.). Čárkou oddělené.',
      )
      .addText((text) =>
        text
          .setPlaceholder('_templates, 1_Agents')
          .setValue(this.plugin.settings.excludedFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
          }),
      );

    // === Reset to defaults ===
    new Setting(containerEl)
      .setName('Resetovat na výchozí')
      .setDesc('Smaže overrides — daily folder se vrátí na core config, excluded folders na _templates + 1_Agents.')
      .addButton((btn) =>
        btn
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.dailyFolderOverride = '';
            this.plugin.settings.excludedFolders = ['_templates', '1_Agents'];
            await this.plugin.saveSettings();
            this.plugin.notifyRepoConfigChanged();
            this.display(); // re-render
          }),
      );
  }
}
