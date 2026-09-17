import { FuzzySuggestModal, type App, type TFolder } from 'obsidian';

/**
 * Fuzzy výběr složky ze seznamu složek ve vault-u.
 *
 * Používá se v deklarativním settings tabu (Obsidian 1.13+), kde seznam
 * vyloučených složek renderuje framework a vlastní text input s
 * {@link FolderSuggest} tam není k dispozici.
 */
export class ExcludeFolderModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly alreadyExcluded: string[],
    private readonly onPick: (path: string) => void,
  ) {
    super(app);
    this.setPlaceholder('Pick a folder to exclude…');
  }

  getItems(): TFolder[] {
    const skip = new Set(this.alreadyExcluded.map((f) => f.toLowerCase()));
    return this.app.vault.getAllFolders().filter((folder) => !skip.has(folder.path.toLowerCase()));
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onPick(folder.path);
  }
}
