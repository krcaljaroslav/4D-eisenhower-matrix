import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { Platform } from 'obsidian';
import { collectPropertyKeys } from '../src/obsidian-adapter/properties.ts';
import { DEFAULT_SETTINGS } from '../src/settings/settings.ts';

vi.mock('obsidian', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian')>(),
  Platform: { isMobile: false },
  PluginSettingTab: class {},
  AbstractInputSuggest: class {},
  FuzzySuggestModal: class {},
}));

import { MatrixSettingsTab } from '../src/settings/SettingsTab.ts';

afterEach(() => { Platform.isMobile = false; });

describe('settings control platform default', () => {
  it.each([false, true])('resolves the displayed value on mobile=%s', (isMobile) => {
    Platform.isMobile = isMobile;
    const plugin = { settings: { ...DEFAULT_SETTINGS } };
    const tab = new MatrixSettingsTab({} as App, plugin as never);
    expect(tab.getControlValue('openSourceOnClick')).toBe(!isMobile);
    for (const override of [true, false]) {
      plugin.settings.openSourceOnClick = override;
      expect(tab.getControlValue('openSourceOnClick')).toBe(override);
    }
  });
});

it('omits property keys from today-only daily sources', () => {
  const getCache = vi.fn((path: string) => ({ frontmatter: path === 'daily.md' ? { dailyOnly: true } : { project: 'work' } }));
  const app = { metadataCache: { getCache } } as unknown as App;
  expect(collectPropertyKeys(app, [
    { sourceFile: 'daily.md', isFromDnes: true },
    { sourceFile: 'project.md', isFromDnes: false },
  ])).toEqual(['project']);
  expect(getCache.mock.calls).toEqual([['project.md']]);
});
