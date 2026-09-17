import type { App, TFile } from 'obsidian';
import { normalizePath, TFolder } from 'obsidian';

/**
 * Vrátí složku, kam ukládat daily notes. Priorita:
 *   1. `override` (z plugin settings) — pokud neprázdný, použij
 *   2. core plugin „Daily notes" — uživatelův global config
 *   3. fallback: vault root (prázdný string)
 */
export function getDailyNotesFolder(app: App, override?: string): string {
  if (override && override.trim()) return override.trim();

  const internalPlugins = (app as unknown as InternalApp).internalPlugins;
  const dailyNotes = internalPlugins?.plugins?.['daily-notes'];
  if (dailyNotes?.enabled && dailyNotes.instance?.options?.folder !== undefined) {
    return dailyNotes.instance.options.folder ?? '';
  }
  return '';
}

/**
 * Cesta k template souboru z core pluginu „Daily notes" (pokud má uživatel
 * template nakonfigurovaný). Vrací prázdný string pokud žádný není.
 */
export function getDailyNotesTemplatePath(app: App): string {
  const internalPlugins = (app as unknown as InternalApp).internalPlugins;
  const dailyNotes = internalPlugins?.plugins?.['daily-notes'];
  if (dailyNotes?.enabled && dailyNotes.instance?.options?.template) {
    return dailyNotes.instance.options.template;
  }
  return '';
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || normalized === '.' || normalized === '/') return;

  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing instanceof TFolder) return;

  // Recursively ensure parent folder exists first
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash !== -1) {
    const parent = normalized.substring(0, lastSlash);
    await ensureFolderExists(app, parent);
  }

  await app.vault.createFolder(normalized);
}

function shouldUseNestedFormat(app: App, folder: string): boolean {
  // Check daily-notes plugin config
  const internalPlugins = (app as unknown as any).internalPlugins;
  const dailyNotes = internalPlugins?.plugins?.['daily-notes'];
  if (dailyNotes?.enabled && dailyNotes.instance?.options?.format) {
    const format = dailyNotes.instance.options.format;
    if (format.includes('/')) {
      return true;
    }
  }

  // Check if there are any existing nested daily notes in the vault
  const files = app.vault.getMarkdownFiles();
  for (const f of files) {
    let relPath = f.path;
    if (folder !== '') {
      if (!relPath.startsWith(folder + '/')) continue;
      relPath = relPath.substring(folder.length + 1);
    }
    const parts = relPath.split('/');
    if (parts.length === 3) {
      const [year, month, filename] = parts;
      if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month) && /^\d{4}-\d{2}-\d{2}\.md$/.test(filename)) {
        return true;
      }
    }
  }

  return false;
}

export function getDailyNoteFilenameFormat(_app: App): string {
  return 'YYYY-MM-DD';
}

/**
 * Cesta k daily note souboru pro daný ISO datum.
 */
export function buildDailyNotePath(app: App, isoDate: string, override?: string): string {
  const folder = getDailyNotesFolder(app, override);
  
  // 1. First, check if the nested file already exists in the vault.
  const year = isoDate.substring(0, 4);
  const month = isoDate.substring(5, 7);
  const nestedSubpath = `${year}/${month}/${isoDate}.md`;
  const nestedPath = folder ? normalizePath(`${folder}/${nestedSubpath}`) : nestedSubpath;
  
  if (app.vault.getFileByPath(nestedPath)) {
    return nestedPath;
  }
  
  // 2. Second, check if the flat file already exists in the vault.
  const flatSubpath = `${isoDate}.md`;
  const flatPath = folder ? normalizePath(`${folder}/${flatSubpath}`) : flatSubpath;
  
  if (app.vault.getFileByPath(flatPath)) {
    return flatPath;
  }

  // 3. If neither exists, decide how to build it based on detection:
  if (shouldUseNestedFormat(app, folder)) {
    return nestedPath;
  }
  
  return flatPath;
}

/**
 * Pokud daily note pro `isoDate` neexistuje, vytvoří ji:
 *   1. Pokud má uživatel v core „Daily notes" nastavený template → použij ten
 *   2. Jinak → vlož minimální scaffold (frontmatter + `# Today` heading)
 *
 * Vrací `TFile` existujícího nebo nově vytvořeného souboru.
 */
export async function ensureDailyExists(
  app: App,
  isoDate: string,
  sectionHeading: string,
  override?: string,
): Promise<TFile> {
  const targetPath = buildDailyNotePath(app, isoDate, override);
  const existing = app.vault.getFileByPath(targetPath);
  if (existing) return existing;

  // Ensure parent folder exists
  const lastSlash = targetPath.lastIndexOf('/');
  if (lastSlash !== -1) {
    const parentFolder = targetPath.substring(0, lastSlash);
    await ensureFolderExists(app, parentFolder);
  }

  // Try to use core Daily Notes template
  const templatePath = getDailyNotesTemplatePath(app);
  let initialContent = '';

  if (templatePath) {
    const templateFile = app.vault.getFileByPath(
      templatePath.endsWith('.md') ? templatePath : `${templatePath}.md`,
    );
    if (templateFile) {
      const raw = await app.vault.cachedRead(templateFile);
      initialContent = applyTemplateVariables(raw, isoDate);
    }
  }

  if (!initialContent) {
    initialContent = buildMinimalScaffold(isoDate, sectionHeading);
  }

  // Ujistíme se, že obsah obsahuje sekční heading (aggregator + appendTaskUnderHeading
  // z lineOps ho potřebuje).
  const headingNorm = sectionHeading.trim().toLowerCase();
  const hasHeading = initialContent
    .split(/\r?\n/)
    .some((l) => /^#+\s/.test(l) && l.trim().toLowerCase() === headingNorm);
  if (!hasHeading) {
    initialContent = `${initialContent.trimEnd()}\n\n${sectionHeading.trim()}\n`;
  }

  return await app.vault.create(targetPath, initialContent);
}

function buildMinimalScaffold(isoDate: string, sectionHeading: string): string {
  const d = parseISODate(isoDate);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekday = weekdays[d.getDay()];
  const month = months[d.getMonth()];

  return [
    '---',
    `date: ${isoDate}`,
    'tags:',
    '  - daily',
    '---',
    '',
    `# ${weekday} ${d.getDate()} ${month} ${d.getFullYear()}`,
    '',
    sectionHeading.trim(),
    '',
  ].join('\n');
}

/**
 * Velmi jednoduchá expanze základních Obsidian template proměnných:
 *   {{date}}, {{date:FORMAT}} → ISO datum
 *   {{title}} → ISO datum
 *   {{time}} → HH:mm
 *
 * Pro plný support (incl. moment.js) by bylo potřeba více práce — pro
 * Phase C stačí toto minimum, většina daily templates používá jen {{date}}.
 */
function applyTemplateVariables(template: string, isoDate: string): string {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return template
    .replace(/\{\{\s*date(?::[^}]+)?\s*\}\}/g, isoDate)
    .replace(/\{\{\s*title\s*\}\}/g, isoDate)
    .replace(/\{\{\s*time(?::[^}]+)?\s*\}\}/g, time);
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// === Internal Obsidian API shape (untyped in public types) ===
type InternalApp = {
  internalPlugins: {
    plugins: {
      'daily-notes'?: {
        enabled: boolean;
        instance?: {
          options?: {
            folder?: string;
            format?: string;
            template?: string;
          };
        };
      };
    };
  };
};
