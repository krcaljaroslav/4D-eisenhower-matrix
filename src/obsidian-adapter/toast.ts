import { Notice } from 'obsidian';

/**
 * Tenká fasáda nad Obsidian `Notice` API. V budoucnu může mít více variant
 * (success / warning); zatím jen error a info.
 */
export function showError(message: string): void {
  const notice = new Notice(`⚠ ${message}`, 5000);
  // Obsidian Notice nemá přímou API pro barvy, ale můžeme přidat CSS class:
  // `messageEl` je od Obsidianu 1.8.7, což je i minAppVersion pluginu.
  notice.messageEl.addClass('em-notice-error');
}

export function showInfo(message: string): void {
  new Notice(message, 3000);
}
