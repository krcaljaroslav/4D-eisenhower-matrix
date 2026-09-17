import { type App, Modal, requireApiVersion, Setting } from 'obsidian';

/**
 * Potvrzovací dialog nad Obsidian `Modal`.
 *
 * Nahrazuje globální `confirm()`, které v Obsidianu není povolené: v popout
 * okně ukazuje dialog nad špatným oknem a v mobilním webview může být
 * potlačené úplně. Na rozdíl od `confirm()` neblokuje - volající počká na
 * callback, nebo na promise z {@link confirmDialog}.
 */
export class ConfirmModal extends Modal {
  private confirmed = false;
  private decided = false;

  constructor(
    app: App,
    private readonly question: string,
    private readonly confirmLabel: string,
    private readonly onDecision: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl('p', { text: this.question });
    new Setting(this.contentEl)
      .addButton((btn) => {
        btn.setButtonText(this.confirmLabel).onClick(() => {
          this.confirmed = true;
          this.close();
        });
        // `setDestructive()` je až od 1.13.0; na starších verzích zůstane tlačítko
        // bez zvýraznění, stejně jako u ostatních destruktivních akcí v nastavení.
        if (requireApiVersion('1.13.0')) btn.setDestructive();
      })
      .addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
    // Callback právě jednou za život instance: `onClose()` může přijít podruhé
    // (Escape po potvrzení, dvojí `close()`, zavření Obsidianem) a druhé volání
    // by jinak akci buď zopakovalo, nebo ji přebilo opačným rozhodnutím.
    if (this.decided) return;
    this.decided = true;
    this.onDecision(this.confirmed);
  }
}

/**
 * `ConfirmModal` jako promise - náhrada `confirm()` ve volajících, které už jsou
 * async. Escape i tlačítko Cancel vrací `false`, stejně jako `confirm()`.
 */
export function confirmDialog(app: App, question: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, question, confirmLabel, resolve).open();
  });
}
