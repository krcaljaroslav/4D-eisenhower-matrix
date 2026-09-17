import { AbstractInputSuggest, type App } from 'obsidian';

/**
 * Suggester pro text input s mezerou-oddělenými tagy.
 * Při psaní napovídá existující tagy z vault-u (předané přes `getAvailableTags()`).
 *
 * Chování:
 *   - Řeší jen POSLEDNÍ token v inputu (tj. ten, co uživatel právě píše).
 *   - Ostatní tokeny ignoruje + filtruje je z návrhů (žádné duplicity).
 *   - Na výběr: nahradí poslední token + přidá trailing mezeru, aby uživatel
 *     mohl rovnou psát další tag.
 *   - Pokud uživatel nepsal nic (input končí mezerou nebo je prázdný), ukáže
 *     top tagy (limit 15).
 */
export class TagSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
    private readonly getAvailableTags: () => string[],
  ) {
    super(app, inputEl);
  }

  protected getSuggestions(_query: string): string[] {
    const { currentToken, usedTagsLower } = this.parseInput();
    const stripped = currentToken.startsWith('#') ? currentToken.slice(1) : currentToken;
    const lower = stripped.toLowerCase();

    return this.getAvailableTags()
      .filter((tag) => {
        if (usedTagsLower.has(tag.toLowerCase())) return false;
        if (lower.length === 0) return true; // prázdný token = ukaž vše
        return tag.toLowerCase().includes(lower);
      })
      .slice(0, 15);
  }

  renderSuggestion(tag: string, el: HTMLElement): void {
    // Vlastní třída → můžeme spolehlivě nastylovat vybraný řádek
    // přes accent barvu, která je čitelná v každém theme (některé
    // komunitní themes přepisují default --background-modifier-hover
    // na skoro průhlednou hodnotu a vybraný řádek pak není vidět).
    el.addClass('em-tag-suggestion');
    el.setText(tag);
  }

  selectSuggestion(tag: string): void {
    const value = this.inputEl.value;
    const tokens = value.split(/\s+/).filter((t) => t.length > 0);
    const endsWithSpace = /\s$/.test(value);

    const newTokens =
      endsWithSpace || tokens.length === 0
        ? [...tokens, tag]
        : [...tokens.slice(0, -1), tag];

    // Trailing space — uživatel může rovnou psát další tag.
    const newValue = newTokens.join(' ') + ' ';

    // React drží interní value tracker; nastavení .value přímo ho obejde
    // a onChange handler v Reactu se nezavolá → controlled state ve formu
    // by zůstal s tím, co uživatel naťukal před výběrem (tj. selection by
    // se po Save „ztratila"). Použijeme nativní setter z prototype, aby
    // React změnu zaregistroval jako legitimní user input.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- native value setter, invoked via .call with explicit receiver below
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(this.inputEl, newValue);
    } else {
      this.inputEl.value = newValue;
    }
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    this.inputEl.focus();
    this.close();
  }

  private parseInput(): { currentToken: string; usedTagsLower: Set<string> } {
    const value = this.inputEl.value;
    const tokens = value.split(/\s+/).filter((t) => t.length > 0);
    const endsWithSpace = /\s$/.test(value);

    let currentToken: string;
    let usedTokens: string[];
    if (endsWithSpace || tokens.length === 0) {
      currentToken = '';
      usedTokens = tokens;
    } else {
      currentToken = tokens[tokens.length - 1];
      usedTokens = tokens.slice(0, -1);
    }

    const usedTagsLower = new Set(
      usedTokens.map((t) => (t.startsWith('#') ? t : `#${t}`).toLowerCase()),
    );
    return { currentToken, usedTagsLower };
  }
}
