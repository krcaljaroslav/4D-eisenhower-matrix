import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, resolveOpenSourceOnClick } from '../src/settings/settings.ts';

describe('source navigation defaults', () => {
  it('keeps the automatic default when desktop settings are saved and loaded on mobile', () => {
    const saved = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    expect(saved).not.toHaveProperty('openSourceOnClick');
    expect(resolveOpenSourceOnClick(saved.openSourceOnClick, false)).toBe(true);
    expect(resolveOpenSourceOnClick(saved.openSourceOnClick, true)).toBe(false);
  });

  it.each([true, false])('honors explicit override %s on either platform', (override) => {
    expect(resolveOpenSourceOnClick(override, false)).toBe(override);
    expect(resolveOpenSourceOnClick(override, true)).toBe(override);
  });

  it('disables the property filter by default', () => {
    expect(DEFAULT_SETTINGS.showPropertyFilter).toBe(false);
  });
});
