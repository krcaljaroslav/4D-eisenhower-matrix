import type { App, TFile } from 'obsidian';
import { parseAllTasks, parseDaily } from '../core/parser.ts';
import {
  appendTaskUnderDnes,
  moveLineQuadrant,
  setDueDateOnLine,
  toggleLine,
  transformLineInContent,
  updateLineTextAndTags,
  type UpdateOptions,
} from '../core/lineOps.ts';
import type { Priority, Quadrant, Task } from '../core/types.ts';
import {
  buildDailyNotePath,
  ensureDailyExists,
  getDailyNotesFolder,
} from './dailyNotes.ts';

const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

/**
 * Read + write přístup k taskům přes Obsidian Vault API.
 * Write operace běží přes `app.vault.process()` — atomic + serializovaný.
 */
export class ObsidianTaskRepo {
  private excludedFolders: string[];
  private dailyFolderOverride: string;

  constructor(
    private app: App,
    excludedFolders: string[] = [],
    dailyFolderOverride: string = '',
  ) {
    this.excludedFolders = excludedFolders;
    this.dailyFolderOverride = dailyFolderOverride;
  }

  setDailyFolderOverride(folder: string) {
    this.dailyFolderOverride = folder;
  }

  // ============================================================
  // READ
  // ============================================================

  async getMatrixTasks(date: string): Promise<{
    tasks: Task[];
    todayFileExists: boolean;
    scannedFiles: number;
  }> {
    const dailyPath = buildDailyNotePath(this.app, date, this.dailyFolderOverride);
    const dailyFile = this.app.vault.getFileByPath(dailyPath);

    const dnesTasks: Task[] = [];
    let todayFileExists = false;

    if (dailyFile) {
      todayFileExists = true;
      const raw = await this.app.vault.cachedRead(dailyFile);
      const { tasks } = parseDaily(raw);
      for (const t of tasks) {
        dnesTasks.push({ ...t, sourceFile: dailyFile.path, isFromDnes: true });
      }
    }

    const allFiles = this.app.vault.getMarkdownFiles();
    const otherTasks: Task[] = [];
    let scanned = 0;

    for (const file of allFiles) {
      if (dailyFile && file.path === dailyFile.path) continue;
      if (this.isExcluded(file)) continue;

      scanned++;
      const raw = await this.app.vault.cachedRead(file);
      const tasks = parseAllTasks(raw);
      for (const t of tasks) {
        if (!t.text) continue;
        otherTasks.push({ ...t, sourceFile: file.path, isFromDnes: false });
      }
    }

    const seen = new Set<string>();
    const merged: Task[] = [];
    for (const t of [...dnesTasks, ...otherTasks]) {
      const key = `${t.sourceFile}:${t.lineIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(t);
    }

    return { tasks: merged, todayFileExists, scannedFiles: scanned };
  }

  getExistingDailyDates(): Set<string> {
    const folder = getDailyNotesFolder(this.app, this.dailyFolderOverride);
    const dates = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();
    for (const f of files) {
      const fileDir = f.parent?.path ?? '';
      const inFolder =
        folder === '' ? (fileDir === '' || fileDir === '/') : fileDir === folder;
      if (!inFolder) continue;
      const m = DATE_FILE_RE.exec(f.name);
      if (m) dates.add(m[1]);
    }
    return dates;
  }

  // ============================================================
  // WRITE
  // ============================================================

  async toggleTask(sourceFile: string, lineIndex: number, todayISO: string): Promise<void> {
    const file = this.requireFile(sourceFile);
    await this.app.vault.process(file, (content) =>
      transformLineInContent(content, lineIndex, (line) => toggleLine(line, todayISO).newLine),
    );
  }

  async moveTask(
    sourceFile: string,
    lineIndex: number,
    newQuadrant: Quadrant,
  ): Promise<void> {
    const file = this.requireFile(sourceFile);
    await this.app.vault.process(file, (content) =>
      transformLineInContent(
        content,
        lineIndex,
        (line) => moveLineQuadrant(line, newQuadrant).newLine,
      ),
    );
  }

  async setDueDate(
    sourceFile: string,
    lineIndex: number,
    newDueDate: string | null,
  ): Promise<void> {
    const file = this.requireFile(sourceFile);
    await this.app.vault.process(file, (content) =>
      transformLineInContent(
        content,
        lineIndex,
        (line) => setDueDateOnLine(line, newDueDate).newLine,
      ),
    );
  }

  async updateTask(
    sourceFile: string,
    lineIndex: number,
    text: string,
    contextTags: string[],
    options: UpdateOptions = {},
  ): Promise<void> {
    const file = this.requireFile(sourceFile);
    await this.app.vault.process(file, (content) =>
      transformLineInContent(
        content,
        lineIndex,
        (line) => updateLineTextAndTags(line, text, contextTags, options).newLine,
      ),
    );
  }

  /**
   * Přidá task pod `# Dnes` v daily note pro `date`. Pokud daily note neexistuje,
   * vytvoří ji přes core „Daily notes" template (nebo minimum scaffold).
   *
   * Vrací `sourceFile` (cestu k daily souboru) — UI ji pak může použít pro refetch.
   */
  async addTask(
    date: string,
    text: string,
    quadrant: Quadrant,
    dueDate?: string | null,
    priority?: Priority | null,
  ): Promise<{ sourceFile: string; lineIndex: number; newLine: string }> {
    const file = await ensureDailyExists(this.app, date, this.dailyFolderOverride);

    let lineIndex = -1;
    let newLine = '';
    await this.app.vault.process(file, (content) => {
      const result = appendTaskUnderDnes(content, text, quadrant, date, dueDate, priority);
      lineIndex = result.lineIndex;
      newLine = result.newLine;
      return result.newContent;
    });

    return { sourceFile: file.path, lineIndex, newLine };
  }

  // ============================================================
  // Helpers
  // ============================================================

  private requireFile(sourcePath: string): TFile {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) throw new Error(`File not found in vault: ${sourcePath}`);
    return file;
  }

  private isExcluded(file: TFile): boolean {
    return this.excludedFolders.some(
      (folder) => file.path === folder || file.path.startsWith(folder + '/'),
    );
  }

  setExcludedFolders(folders: string[]) {
    this.excludedFolders = folders;
  }
}
