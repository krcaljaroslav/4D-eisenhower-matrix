**English** · [Čeština](README.cs.md)

# 4D Eisenhower Matrix — Obsidian plugin

Visualize tasks across your entire vault in a **5-quadrant Eisenhower matrix** (DO / DECIDE / DELEGATE / DELETE / OPEN). Reads and writes [Obsidian Tasks](https://publish.obsidian.md/tasks/Introduction) syntax — `#tags`, `📅 due`, `🛫 start`, `✅ done`, priority emoji.

> A morning dashboard for deciding *what to do now*: open it, see tasks split by priority, check off the done ones, add new ones. Markdown files stay the source of truth — the plugin is just a visual layer on top.

> **Note:** the screenshots below were taken before the UI was localized — they still show Czech labels. The plugin UI is now in English.

<table>
  <tr>
    <td><img src="docs/Light.png" alt="Light theme" /></td>
    <td><img src="docs/Dark.png" alt="Dark theme" /></td>
  </tr>
  <tr>
    <td colspan="2" align="center">
      <img src="docs/Mobil.jpg" alt="Mobile" width="320" />
    </td>
  </tr>
</table>

## Features

- **5-quadrant matrix** — the quadrant is determined by the **first `#tag`** after the checkbox: `#DO`, `#DECIDE`, `#DELEGATE`, `#DELETE`. Anything else → OPEN.
- **Cross-vault aggregation** — collects tasks from **all `.md` files** in the vault (Dataview-like), not just today's daily note.
- **Full CRUD** — add (form with text + tags + due date + priority), edit, toggle, move between quadrants.
- **Priority** following the Obsidian Tasks convention: 🔺 highest · ⏫ high · 🔼 medium · 🔽 low · ⏬ lowest
- **Tag autocomplete** — suggests existing vault tags while typing (avoids duplicates).
- **Markdown formatting** — basic inline Markdown in task text (bold, italic, code, strikethrough).
- **Compact mode** — a header toggle that shrinks every card to two lines (text + priority/due date).
- **Filter** by context tag (OR logic + a virtual "Other" chip).
- **Date navigation** (← / → / calendar / Today) + a day-cutoff banner after midnight.
- **3 s grace period** after checking a task off (green border + countdown — click again to undo).
- **Sticky header** + collapsible header for mobile.
- **In-quadrant sorting**: overdue → priority desc → due date asc → alphabetical.
- **Desktop and mobile** (tested on Android).
- **Respects the core "Daily notes" plugin** — folder + template (with `{{date}}`, `{{title}}`, `{{time}}` substitution).

## Installation

### Via BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) is an Obsidian community plugin for installing plugins straight from GitHub (with auto-update).

1. Settings → Community plugins → Browse → search for **BRAT** → Install + Enable
2. `Ctrl+P` (mobile: 3-dot menu → Command palette) → **"BRAT: Add a beta plugin for testing"**
3. Paste the URL: `https://github.com/krcaljaroslav/4D-eisenhower-matrix`
4. Add Plugin
5. Settings → Community plugins → enable **4D Eisenhower Matrix**
6. Open via the ribbon icon (grid icon in the left sidebar) or `Ctrl+P` → "Open matrix"

Updates appear automatically within 15 minutes of a new [release](https://github.com/krcaljaroslav/4D-eisenhower-matrix/releases), or manually via `BRAT: Check for updates to all beta plugins`.

### Manual (without BRAT)

Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/krcaljaroslav/4D-eisenhower-matrix/releases/latest) and drop them into `<vault>/.obsidian/plugins/four-d-eisenhower-matrix/`. Then Settings → Community plugins → enable.

## Task syntax

The plugin reads/writes standard Obsidian Tasks syntax:

```markdown
- [ ] #DO #Personal ⏫ 📅 2026-05-20 🛫 2026-05-15 Important call with Alice
- [x] #DECIDE Long-term planning ✅ 2026-05-10
- [ ] task without a quadrant tag  ← lands in the OPEN quadrant
```

Quadrant tags (the first token after `- [ ]`):

| Tag | Quadrant | Meaning |
|-----|----------|---------|
| `#DO` | 🔴 DO | Important + Urgent |
| `#DECIDE` | 🔵 DECIDE | Important + Less Urgent |
| `#DELEGATE` | 🟢 DELEGATE | Less Important + Urgent |
| `#DELETE` | 🟡 DELETE | Less Important + Less Urgent |
| *(other / none)* | ⚫ OPEN | Uncategorized |

Priority ([Obsidian Tasks convention](https://publish.obsidian.md/tasks/Getting+Started/Priorities)):

| Emoji | Level |
|-------|-------|
| 🔺 | Highest |
| ⏫ | High |
| 🔼 | Medium |
| 🔽 | Low |
| ⏬ | Lowest |

## Controls

| Action | How |
|--------|-----|
| Toggle a task | Click the checkbox · 3 s grace period (click again to undo) |
| Add a task | Click `+` in the quadrant header → text + #tags + 📅 + ⏫ → Enter |
| Edit a task | **Desktop:** double-click the card. **Mobile:** long-press / double-tap → menu → Edit |
| Change due date alone | Click the 📅 badge on the card |
| Move between quadrants | **Desktop:** drag the card onto the target quadrant. **Mobile:** long-press / double-tap → menu → "Move to…" |
| Open the source file | **Desktop:** right-click the card. **Mobile:** long-press / double-tap. → menu (current pane / new tab / split / window) — the cursor lands on the task's line |
| Filter by tag | Click a chip in the filter bar (multi-select, OR) |
| Previous / next day | The ← → arrows in the header, the calendar, or "Today" |
| Collapse a quadrant | Click the ▼/▶ arrow next to the quadrant name |
| Collapse the whole header | The ▲ button top-right (handy on mobile) |
| Show completed tasks | The "Done" toggle in the header |
| Compact view | The "Compact" toggle in the header — 2-line cards |

### In-quadrant order

Deterministic — cannot be reordered manually:
1. **Overdue** (📅 < today) — at the top
2. **Priority desc** — 🔺 → ⏫ → 🔼 → 🔽 → ⏬ → no priority
3. **Due date asc** — nearest deadline first
4. **Alphabetical** by text

The manual lever for reordering is **priority** — set it and the task jumps up.

## Settings

`Settings → 4D Eisenhower Matrix`:

- **Daily folder** — where new daily notes are created. Empty = respect the core "Daily notes" plugin config. Override = a custom path (with a folder suggester).
- **Daily section heading** — the heading in the daily note under which today's tasks are read and added. Default: `# Dnes`. Set it to whatever you use (e.g. `# Today`, `## Tasks`).
- **Excluded folders** — tasks from these folders are ignored. Default: none — add the folders you want excluded yourself. UI with + / × buttons and a folder suggester.

## Daily note integration

The plugin looks for a configurable section heading in the daily note (set via **Settings → Daily section heading**, default `# Dnes`). New tasks are inserted under that heading.

If a daily note for the given day doesn't exist and you add the first task, the plugin **creates it automatically**:
1. If the core "Daily notes" plugin has a **template** configured, it uses that (expanding `{{date}}`, `{{title}}`, `{{time}}`).
2. Otherwise it falls back to a minimal scaffold (frontmatter + the configured section heading).

## Mobile

Works on Android (`isDesktopOnly: false`; iOS untested but should work).

- **Long-press or double-tap** a card → context menu (Edit · Open file · **Move to…**)
- **Moving between quadrants** on mobile is done via the menu ("Move → DECIDE" etc.). Touch-drag is unreliable inside the Obsidian mobile webview, so the menu is used instead — two taps, deterministic.
- **Collapsed header** (the ▲ button) — frees up vertical space for the matrix.

## Roadmap

- [ ] Quick-add task via the Command Palette (without opening the view)
- [ ] Keyboard shortcuts inside the view (J/K navigation, X toggle, N new task)
- [ ] Full moment.js syntax in daily templates (currently only `{{date}}` / `{{title}}` / `{{time}}`)

Missing something? [Open an issue](https://github.com/krcaljaroslav/4D-eisenhower-matrix/issues).

## Known limitations

- Manual ordering across files (one task in a daily note, another in a project) is not supported — the sort is deterministic.

## Bugs / contributing

[Issues](https://github.com/krcaljaroslav/4D-eisenhower-matrix/issues) · Pull requests welcome.

## License

[MIT](LICENSE)
