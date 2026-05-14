# Eisenhower Matrix — Obsidian plugin

Vizualizace tasků napříč celým vault-em v **5-polové Eisenhower matici** (DO / DECIDE / DELEGATE / DELETE / OPEN). Čte a zapisuje [Obsidian Tasks](https://publish.obsidian.md/tasks/Introduction) syntaxi — `#tagy`, `📅 due`, `🛫 start`, `✅ done`, priority emoji.

> Ranní dashboard pro rozhodnutí *co dělat teď*: ráno otevřu, vidím tasky rozdělené podle priority, odškrtnu hotové, případně přidám nové. Source-of-truth zůstávají MD soubory, plugin je jen vizuální vrstva nad nimi.

<!-- Screenshot sem (až bude):
![screenshot](docs/screenshot.png)
-->

## Co to umí

- **5-polová matice** — kvadrant určuje **první `#tag`** za checkboxem: `#DO`, `#DECIDE`, `#DELEGATE`, `#DELETE`. Cokoli jiného → OPEN.
- **Cross-vault agregace** — sbírá tasky ze **všech `.md` souborů** ve vaultu (Dataview-like), ne jen z dnešní daily note.
- **Plné CRUD** — přidání (formulář s text + tagy + due date + priorita), editace dvojklikem, odškrtnutí, drag mezi kvadranty.
- **Priorita** podle Obsidian Tasks konvence: 🔺 highest · ⏫ high · 🔼 medium · 🔽 low · ⏬ lowest
- **Filtr** podle context tagu (OR logika + virtuální „Ostatní" chip)
- **Datum navigace** (← / → / kalendář / Dnes) + den-cutoff banner po půlnoci
- **Pravý klik na task** → otevři source soubor (current pane / nová záložka / split / nové okno) — kurzor přistane přímo na řádku tasku
- **3 s grace period** po odškrtnutí (zelený rámeček + odpočet — klikni znovu pro vrácení)
- **Sticky header** + sbalitelná hlavička pro mobilní zobrazení
- **Sortování v kvadrantu**: overdue → priorita desc → due date asc → alfabeticky
- **Mobile** (Android testováno)
- **Respektuje core „Daily notes"** — folder + template (s `{{date}}`, `{{title}}`, `{{time}}` substitucí)

## Instalace

### Přes BRAT (doporučeno)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) je Obsidian community plugin pro instalaci pluginů přímo z GitHubu (s auto-update).

1. Settings → Community plugins → Browse → vyhledej **BRAT** → Install + Enable
2. `Ctrl+P` (na mobilu: 3 tečky → Command palette) → **„BRAT: Add a beta plugin for testing"**
3. Vlož URL: `https://github.com/krcaljaroslav/obsidian-eisenhower-matrix`
4. Add Plugin
5. Settings → Community plugins → enable **Eisenhower Matrix**
6. Otevři přes ribbon ikonu (mřížka v levém panelu) nebo `Ctrl+P` → „Open Eisenhower Matrix"

Update se objeví automaticky do 15 minut po vydání nového [releasu](https://github.com/krcaljaroslav/obsidian-eisenhower-matrix/releases). Nebo manuálně přes `BRAT: Check for updates to all beta plugins`.

### Manuálně (bez BRAT)

Stáhni `main.js`, `manifest.json`, `styles.css` z [posledního releasu](https://github.com/krcaljaroslav/obsidian-eisenhower-matrix/releases/latest) a hoď je do `<vault>/.obsidian/plugins/eisenhower-matrix/`. Pak Settings → Community plugins → enable.

## Syntaxe tasků

Plugin čte/zapisuje běžnou Obsidian Tasks syntaxi:

```markdown
- [ ] #DO #Osobní ⏫ 📅 2026-05-20 🛫 2026-05-15 Důležitý call s Alicí
- [x] #DECIDE Dlouhodobé plánování ✅ 2026-05-10
- [ ] task bez quadrant tagu  ← spadne do OPEN kvadrantu
```

Kvadrantové tagy (první token po `- [ ]`):

| Tag | Kvadrant | Význam |
|-----|----------|--------|
| `#DO` | 🔴 DO | Důležité + Urgentní |
| `#DECIDE` | 🔵 DECIDE | Důležité + Méně urgentní |
| `#DELEGATE` | 🟢 DELEGATE | Méně důležité + Urgentní |
| `#DELETE` | 🟡 DELETE | Méně důležité + Méně urgentní |
| *(jiný / žádný)* | ⚫ OPEN | Nezařazené |

Priorita ([Obsidian Tasks konvence](https://publish.obsidian.md/tasks/Getting+Started/Priorities)):

| Emoji | Úroveň |
|-------|--------|
| 🔺 | Nejvyšší |
| ⏫ | Vysoká |
| 🔼 | Střední |
| 🔽 | Nízká |
| ⏬ | Nejnižší |

## Ovládání

| Akce | Jak |
|------|-----|
| Odškrtnout task | Klik na checkbox · 3 s grace period (klik znovu = vrátit) |
| Přidat task | Klik `+` v headeru kvadrantu → text + #tagy + 📅 + ⏫ → Enter |
| Editovat task | **Dvojklik** na kartu (text + tagy + 📅 + ⏫) |
| Změnit termín samostatně | Klik na 📅 badge na kartě |
| Přesun mezi kvadranty | **Drag** karty na cílový kvadrant — mění úvodní tag |
| Otevřít source soubor | **Pravý klik** na kartu → menu (current / nová záložka / split / okno) |
| Filtr podle tagu | Klik na chip ve filter baru (multi-select OR) |
| Předchozí / další den | Šipky ← → v headeru, kalendář, nebo „Dnes" |
| Sbalit kvadrant | Klik na header kvadrantu (▼ / ▶) |
| Sbalit celou hlavičku | ▲ vpravo nahoře (užitečné na mobilu) |
| Zobrazit hotové tasky | Toggle „Hotové" v headeru |

### Pořadí v kvadrantu

Deterministické, nelze ručně přeskupit:
1. **Overdue** (📅 < dnes) — nahoře
2. **Priorita desc** — 🔺 → ⏫ → 🔼 → 🔽 → ⏬ → bez priority
3. **Due date asc** — nejbližší termín první
4. **Alfabeticky** podle textu

Manuální páka přeskupování je **priorita** — nastav ji a task se vyhoupne nahoru.

## Nastavení

`Settings → Eisenhower Matrix`:

- **Daily folder** — kam ukládat nové daily notes. Prázdné = respektuj core plugin „Daily notes" config. Override = vlastní cesta (s folder suggesterem).
- **Vyloučené složky** — tasky z těchto složek se ignorují. Default `_templates`, `1_Agents`. UI s + / × tlačítky a folder suggesterem.

## Daily note integrace

Plugin hledá v daily souboru sekci `# Dnes`. Nové tasky vkládá pod tuto sekci.

Pokud daily note pro daný den neexistuje a přidáš první task, plugin ji **vytvoří automaticky**:
1. Pokud má core plugin „Daily notes" nastavený **template**, použije ho (s expanzí `{{date}}`, `{{title}}`, `{{time}}`)
2. Jinak fallback na minimální scaffold (frontmatter + `# Dnes` heading)

> Aktuálně je hardcoded heading `# Dnes` (česky). Pokud chceš jiný (např. `# Today`), [otevři issue](https://github.com/krcaljaroslav/obsidian-eisenhower-matrix/issues) — udělám konfigurovatelné.

## Mobile

Funguje na Androidu. Pár tipů:
- **Long-press** na kartu = ekvivalent pravého kliknutí (otevři source soubor)
- **Sbalená hlavička** (▲ tlačítko) — uvolní místo pro matici, jinak header zabírá moc viewportu
- Drag mezi kvadranty: long-press 250 ms + táhni — funguje, nekoliduje se scrollováním

iOS nezkoušeno, ale `isDesktopOnly: false` v manifestu by mělo fungovat.

## Roadmap

- [ ] Konfigurovatelný heading sekce (`# Dnes` → user choice)
- [ ] Quick-add task přes Command Palette (bez otvírání view)
- [ ] Klávesové zkratky uvnitř view (J/K navigace, X toggle, N nový task)
- [ ] Plný moment.js syntax v daily templatech (zatím jen `{{date}}`/`{{title}}`/`{{time}}`)
- [ ] Anglická lokalizace UI (zatím česky)

Něco postrádáš? [Issue na GitHubu](https://github.com/krcaljaroslav/obsidian-eisenhower-matrix/issues).

## Známé limity

- UI je momentálně **česky** (Sbalit vše, Hotové, Žádné tasky, atd.). Anglická lokalizace je na roadmap.
- Daily heading je hardcoded `# Dnes`.
- Manuální pořadí napříč soubory (jeden task v daily, jiný v projektu) není podporováno — sort je deterministický.

## Bugs / přispívání

[Issues](https://github.com/krcaljaroslav/obsidian-eisenhower-matrix/issues) · Pull requesty vítané.

## Licence

[MIT](LICENSE)
